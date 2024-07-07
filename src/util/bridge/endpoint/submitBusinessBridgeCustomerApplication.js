const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const fileToBase64 = require("../../fileToBase64");
const { bridgeFieldsToRequestFields, getEndorsementStatus, extractActionsAndFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry");
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

exports.createBusinessBridgeCustomer = async (userId, bridgeId = undefined, isUpdate = false) => {

	let invalidFields = [];
	if (isUpdate && !bridgeId) {
		throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, "Using update but bridge is not provided");
	}

	try {
		// check if user exist
		let { data: user, error: user_error } = await supabaseCall(() => supabase
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
		const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
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
		const { data: uboData, error: uboError } = await supabaseCall(() => supabase
			.from('ultimate_beneficial_owners')
			.select('*')
			.eq('user_id', userId)
		)


		if (uboError) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, uboError.message, uboError);
		}
		if (!uboData) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.RECORD_NOT_FOUND, "Ultimate beneficial owner information not found");
		}

		const ultimateBeneficialOwnersList = await Promise.all(uboData.map(async (ubo) => {
			const formattedBirthDate = ubo.date_of_birth ? new Date(ubo.date_of_birth).toISOString().split('T')[0] : undefined;
			if (!formattedBirthDate) {
				invalidFields.push(`${ubo.legal_first_name} ${ubo.legal_last_name}: date_of_birth is missing or invalid`);
			}

			// Fetch and convert base64 for gov_id_image_front
			const govIdImageFront = ubo.gov_id_front_path ? await supabase.storage.from('compliance_id').createSignedUrl(ubo.gov_id_front_path, 200).then(({ data, error }) => {
				if (error || !data) return null;
				return fileToBase64(data.signedUrl);
			}) : null;

			// Fetch and convert base64 for gov_id_image_back
			const govIdImageBack = ubo.gov_id_back_path ? await supabase.storage.from('compliance_id').createSignedUrl(ubo.gov_id_back_path, 200).then(({ data, error }) => {
				if (error || !data) return null;
				return fileToBase64(data.signedUrl);
			}) : null;

			// Fetch and convert base64 for proof_of_residency
			const proofOfResidency = ubo.proof_of_address_document ? await supabase.storage.from('proof_of_residency').createSignedUrl(ubo.proof_of_residency_path, 200).then(({ data, error }) => {
				if (error || !data) return null;
				return fileToBase64(data.signedUrl);
			}) : null;

			return {
				first_name: ubo.legal_first_name,
				last_name: ubo.legal_last_name,
				birth_date: formattedBirthDate,
				address: {
					street_line_1: ubo.address_line_1,
					street_line_2: ubo.address_line_2,
					city: ubo.city,
					state: ubo.state_province_region,
					postal_code: ubo.postal_code,
					country: ubo.country
				},
				tax_identification_number: ubo.tax_identification_number,
				email: ubo.compliance_email,
				phone: ubo.compliance_phone,
				gov_id_country: ubo.gov_id_country,
				gov_id_image_front: govIdImageFront, // Attached base64 image
				gov_id_image_back: govIdImageBack,   // Attached base64 image
				proof_of_address_document: proofOfResidency // Attached base64 image
			};
		}));



		const idempotencyKey = v4();
		// pre fill info
		const requestBody = {
			type: "business",
			name: userKyc.business_name,
			description: userKyc.business_description,
			email: `${userId}@hifi.com`,
			source_of_funds: userKyc.source_of_funds,
			business_type: userKyc.business_type,
			address: {
				street_line_1: userKyc.address_line_1,
				street_line_2: userKyc.address_line_2,
				city: userKyc.city,
				state: userKyc.state_province_region,
				postal_code: userKyc.postal_code,
				country: userKyc.country
			},
			website: userKyc.website,
			tax_identification_number: userKyc.tax_identification_number,
			has_accepted_terms_of_service: true,
			is_dao: userKyc.is_dao,
			transmits_customer_funds: userKyc.transmits_customer_funds,
			statement_of_funds: userKyc.statement_of_funds,
			compliance_screening_explanation: userKyc.compliance_screening_explanation,
			ultimate_beneficial_owners: ultimateBeneficialOwnersList, // array of ubo objects
			// endoresements
		};


		// fill doc
		const files = [
			{ bucket: 'formation_doc', path: userKyc.formation_doc_path, field: "formation_document" },
			{ bucket: 'proof_of_ownership', path: userKyc.proof_of_ownership_path, field: "ownership_document" },
		];

		await Promise.all(files.map(async ({ bucket, path, field }) => {
			const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 200);
			if (error || !data) {
				return null;
			}
			requestBody[field] = await fileToBase64(data.signedUrl);
		}));



		let url = `${BRIDGE_URL}/v0/customers`
		let options = {
			method: 'POST',
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
			options = {
				method: 'PUT',
				headers: {
					'Api-Key': BRIDGE_API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			}
		}

		// call bridge endpoint
		const response = await fetch(url, options);
		const responseBody = await response.json();

		if (response.ok) {
			// extract rejections
			const reasons = responseBody.rejection_reasons.map((reason) => {
				return reason.developer_reason
			})
			const { requiredActions, fieldsToResubmit } = extractActionsAndFields(reasons)

			//extract base, sepa status
			const { status: baseStatus, actions: baseActions, fields: baseFields } = getEndorsementStatus(responseBody.endorsements, "base")
			const { status: sepaStatus, actions: sepaActions, fields: sepaFields } = getEndorsementStatus(responseBody.endorsements, "sepa")

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
			// EXPERIMENTAL
			const { error: bridge_customers_error } = await supabase
			.from('bridge_customers')
			.update({
				bridge_response: responseBody,
				status: "invalid_fields",
			})
			.eq("user_id", userId)
			.single()

			if (bridge_customers_error) {
				throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customers_error.message, bridge_customers_error)
			}
			// supposed to be missing or invalid field
			invalidFields = Object.keys(responseBody.source.key).map((k) => bridgeFieldsToRequestFields[k]) //FIXME: this returns the db field, not the prop name that the user needs to pass. instead of gov_id_front, we should return govIdFront in the fieldsToResubmit array
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INVALID_FIELD, responseBody.message, responseBody)
		} else if (response.status == 401) {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
		} else {
			throw new createBridgeCustomerError(createBridgeCustomerErrorType.INTERNAL_ERROR, "Unknown error", responseBody)
		}
	} catch (error) {
		//  log
		createLog("user/util/createBusinessBridgeCustomer", userId, error.message, error.rawResponse)
		console.error(`Error occurred in create business bridge user `, error)
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

