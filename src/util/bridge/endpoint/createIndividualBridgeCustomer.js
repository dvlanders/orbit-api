const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const fileToBase64 = require("../../fileToBase64");
const { bridgeFieldsToDatabaseFields } = require("../utils");
const { createLog } = require("../../logger/supabaseLogger");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeCustomerErrorType = {
    RECORD_NOT_FOUND: 0,
    INVALID_FIELD: 1,
    INTERNAL_ERROR: 2,
};

class createBridgeCustomerError extends Error {
    constructor(type, message, rawResponse) {
        super(message);
        this.type = type;
        this.rawResponse = rawResponse;
        Object.setPrototypeOf(this, createBridgeCustomerError.prototype);
    }
}

const getEndorsementStatus = (endorsements, name) => {
    const endorsement = endorsements.find(e => e.name === name);
    return endorsement ? endorsement.status : undefined;
}

exports.createIndividualBridgeCustomer = async(userId) => {
    let invalidFields = [];
    console.log(BRIDGE_API_KEY);

    try {
        // check if user exist
        let { data: user, error: user_error } = await supabase
            .from('users')
            .select('profile_id, user_type')
            .eq('id', userId)
            .maybeSingle();

        if (user_error) {
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, user_error.message, user_error);
        }
        if (!user) {
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.RECORD_NOT_FOUND, "User record not found");
        }

        // fetch user kyc data
        const { data: user_kyc, error: user_kyc_error } = await supabase
            .from('user_kyc')
            .select('*, bridge_customers (signed_agreement_id)')
            .eq('user_id', userId)
            .maybeSingle();

        if (user_kyc_error) {
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, user_kyc_error.message, user_kyc_error);
        }
        if (!user_kyc) {
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.RECORD_NOT_FOUND, "User kyc information record not found");
        }
        if (!user_kyc.bridge_customers || !user_kyc.bridge_customers[0]) {
            invalidFields = ["signed_agreement_id"];
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, "User signed_agreement_id information record not found");
        }

        // submit kyc information to bridge
        const birthDate = user_kyc.date_of_birth ? new Date(user_kyc.date_of_birth) : undefined;
        if (!birthDate) {
            invalidFields = ["date_of_birth"];
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, "Please resubmit the following parameters that are either missing or invalid");
        }
		const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`; 
        const idempotencyKey = v4();
        // pre fill info
        const requestBody = {
            type: "individual",
            first_name: user_kyc.legal_first_name,
            last_name: user_kyc.legal_last_name,
            email: user_kyc.compliance_email,
            phone: user_kyc.compliance_phone,
            address: {
                street_line_1: user_kyc.address_line_1,
                street_line_2: user_kyc.address_line_2,
                city: user_kyc.city,
                state: user_kyc.state_province_region,
                postal_code: user_kyc.postal_code,
                country: user_kyc.country
            },
            signed_agreement_id: user_kyc?.bridge_customers?.[0]?.signed_agreement_id,
            birth_date: formattedBirthDate,
            tax_identification_number: user_kyc.tax_identification_number,
            gov_id_country: user_kyc.gov_id_country
        };

        // fill doc
        const files = [
            { bucket: 'compliance_id', path: user_kyc.gov_id_front_path, field: "gov_id_image_front" },
            { bucket: 'compliance_id', path: user_kyc.gov_id_back_path, field: "gov_id_image_back" },
            { bucket: 'proof_of_residency', path: user_kyc.proof_of_residency_path, field: "proof_of_address_document" }
        ];

        await Promise.all(files.map(async ({ bucket, path, field }) => {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 200);
            if (error || !data) {
                return null;
            }
            requestBody[field] = await fileToBase64(data.signedUrl);
        }));

        // call bridge endpoint
        const response = await fetch(`${BRIDGE_URL}/v0/customers`, {
            method: 'POST',
            headers: {
                'Idempotency-Key': idempotencyKey,
                'Api-Key': BRIDGE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const responseBody = await response.json();
        if (response.ok){
            const { error: bridge_customers_error } = await supabase
			.from('bridge_customers')
			.update({ 
                bridge_id: responseBody.id, 
                bridge_response: responseBody, 
                status: responseBody.status,
                base_status: getEndorsementStatus(responseBody.endorsements, "base"),
                sepa_status: getEndorsementStatus(responseBody.endorsements, "sepa"),
            })
			.eq("id", userId)
            .single()

            if (bridge_customers_error){
                throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customers_error.message, bridge_customers_error)
            }

            return {
                status: 200,
                InvalidFields: [],
                message: "bridge customer created"       
            } 

        }else if (response.status == 400){
            // supposed to be missing or invalid field
            invalidFields = Object.keys(responseBody.source.key).map((k) => bridgeFieldsToDatabaseFields[k])
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, responseBody.message, responseBody)
        }else if (response.status == 401){
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
        }else{
            throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, "Unknown error", responseBody)
        }
    }catch (error){
        //  log
        createLog("user/create", userId, error.message, error.rawResponse)
        console.error(error)
        // process error
        if (error.type == createBridgeCustomerErrorType.INTERNAL_ERROR){
            return {
                status: 500,
                invalidFields: [],
                message: error.message
            }
        }else if (error.type == createBridgeCustomerErrorType.INVALID_FIELD){
            return {
                status: 400,
                invalidFields,
                message: "Please resubmit the following parameters that are either missing or invalid"
            }
        }else if (error.type == createBridgeCustomerErrorType.RECORD_NOT_FOUND){
            return {
                status: 404,
                invalidFields: [],
                message: error.message
            }
        }else{
            return {
                status: 500,
                invalidFields: [],
                message: "Something went wrong, please contact HIFI for more information"
            }
        }
    }
}

