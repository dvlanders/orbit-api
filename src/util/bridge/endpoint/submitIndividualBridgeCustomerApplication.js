const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const fileToBase64 = require("../../fileToBase64");
const { bridgeFieldsToRequestFields, getEndorsementStatus, extractActionsAndFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeCustomerErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class createBridgeCustomerError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createBridgeCustomerError.prototype);
	}
}

/**
 * This util use to pass bridge customer kyc, return status 200 for successful crearion,
 * status 400 for missing or invalid fields with invalidFields array,
 * status 500 and 404 should be seen as server error 
 * @param {*} userId 
 * @returns 
 */

exports.createIndividualBridgeCustomer = async (userId, bridgeId=undefined, isUpdate=false) => {
	let invalidFields = [];
	if (isUpdate && !bridgeId){
		throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, "Using update but bridge is not provided");
	}

	try {
		// check if user exist
		let { data: user, error: user_error } = await supabaseCall( () => supabase
			.from('users')
			.select('profile_id, user_type')
			.eq('id', userId)
			.maybeSingle()
		)

		if (user_error) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, user_error.message, user_error);
		}
		if (!user) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.RECORD_NOT_FOUND, "User record not found");
		}

		// fetch user kyc data
		const { data: userKyc, error: userKycError } = await supabaseCall( () =>  supabase
			.from('user_kyc')
			.select('*')
			.eq('user_id', userId)
			.maybeSingle()
		)


		if (userKycError) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, userKycError.message, userKycError);
		}
		if (!userKyc) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.RECORD_NOT_FOUND, "User kyc information record not found");
		}

		// fetch user kyc data
		// const { data: bridgeUser, error: bridgeUserError } = await supabaseCall( () =>   supabase
		// .from('bridge_customers')
		// .select('signed_agreement_id')
		// .eq('user_id', userId)
		// .maybeSingle()
		// )

		// if (bridgeUserError) {
		// 	throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, bridgeUserError.message, bridgeUserError);
		// }

		// if (!bridgeUser || !bridgeUser.signed_agreement_id) {
		// 	invalidFields = ["signed_agreement_id"];
		// 	throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, "User signed_agreement_id information record not found");
		// }

		// submit kyc information to bridge
		const birthDate = userKyc.date_of_birth ? new Date(userKyc.date_of_birth) : undefined;
		if (!birthDate) {
			invalidFields = ["date_of_birth"];
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, "Please resubmit the following parameters that are either missing or invalid");
		}
		const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`;
		const idempotencyKey = v4();
		// pre fill info
		const requestBody = {
			type: "individual",
			first_name: userKyc.legal_first_name,
			last_name: userKyc.legal_last_name,
			email: `${userId}@hifi.com`,
			phone: userKyc.compliance_phone,
			address: {
				street_line_1: userKyc.address_line_1,
				street_line_2: userKyc.address_line_2,
				city: userKyc.city,
				state: userKyc.state_province_region,
				postal_code: userKyc.postal_code,
				country: userKyc.country
			},
			signed_agreement_id: userKyc.signed_agreement_id, //FIXME 
			has_accepted_terms_of_service: true,
			birth_date: formattedBirthDate,
			tax_identification_number: userKyc.tax_identification_number,
			gov_id_country: userKyc.gov_id_country
		};

		// fill doc
		const files = [
			{ bucket: 'compliance_id', path: userKyc.gov_id_front_path, field: "gov_id_image_front" },
			{ bucket: 'compliance_id', path: userKyc.gov_id_back_path, field: "gov_id_image_back" },
			{ bucket: 'proof_of_residency', path: userKyc.proof_of_residency_path, field: "proof_of_address_document" }
		];

		await Promise.all(files.map(async ({ bucket, path, field }) => {
			const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 200);
			if (error || !data) {
				return null;
			}
			requestBody[field] = await fileToBase64(data.signedUrl);
		}));

		let url = `${BRIDGE_URL}/v0/customers`
		let opstions = {
			method: 'POST' ,
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		}
		// for update
		if (isUpdate) {
			url += `/${bridgeId}` 
			opstions = {
				method: 'PUT',
				headers: {
					'Api-Key': BRIDGE_API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			}
		}

		// call bridge endpoint
		const response = await fetch(url, opstions);
		const responseBody = await response.json();
		if (response.ok) {
			// extract rejections
			const reasons = responseBody.rejection_reasons.map((reason) => {
				return reason.developer_reason
			})
			const {requiredActions, fieldsToResubmit} = extractActionsAndFields(reasons)
	
			//extract base, sepa status
			const {status: baseStatus, actions:baseActions, fields:baseFields} = getEndorsementStatus(responseBody.endorsements, "base")
			const {status: sepaStatus, actions:sepaActions, fields:sepaFields} = getEndorsementStatus(responseBody.endorsements, "sepa")

			const { error: bridge_customers_error } = await supabase
				.from('bridge_customers')
				.update({
					bridge_id: responseBody.id,
					bridge_response: responseBody,
					status: responseBody.status,
					base_status: baseStatus,
					sepa_status: sepaStatus,
				})
				.eq("user_id", userId)
				.single()

			if (bridge_customers_error) {
				throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customers_error.message, bridge_customers_error)
			}

			return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.PENDING,
                    actions: requiredActions,
                    fields: fieldsToResubmit
                },
                usRamp: {
                    status: CustomerStatus.PENDING,
                    actions: baseActions,
                    fields: baseFields
                },
                euRamp: {
                    status: CustomerStatus.PENDING,
                    actions: sepaActions,
                    fields: sepaFields
                },
                message: "kyc aplication still under review"
            }

		} else if (response.status == 400) {
			// supposed to be missing or invalid field
			invalidFields = Object.keys(responseBody.source.key).map((k) => bridgeFieldsToRequestFields[k])
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, responseBody.message, responseBody)
		} else if (response.status == 401) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
		} else {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, "Unknown error", responseBody)
		}
	} catch (error) {
		//  log
		createLog("user/util/createIndividualBridgeCustomer", userId, error.message, error.rawResponse)
		console.error(`Error happens in create individual bridge user `, error)
		// process error
		if (error.type == createBridgeCustomerErrorType.INTERNAL_ERROR) {
			return {
				status: 500,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: "Please contact HIFI for more information"
			}
		} else if (error.type == createBridgeCustomerErrorType.INVALID_FIELD) {
			return {
				status: 200,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: ["update"],
					fields: [...invalidFields]
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: "Please resubmit the following parameters that are either missing, invalid or used"
			}
		} else if (error.type == createBridgeCustomerErrorType.RECORD_NOT_FOUND) {
			return {
				status: 404,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: error.message
			}
		} else {
			return {
				status: 500,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: "Please contact HIFI for more information"
			}
		}
	}
}

