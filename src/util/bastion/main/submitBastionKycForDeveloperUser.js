const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;


const submitBastionKycErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS"
};

class submitBastionKycError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, submitBastionKycError.prototype);
	}
}

const submitKycDataBusiness = async (userId, type) => {

	// get primary ubo information
	const { data: primaryUbo, error: uboError } = await supabaseCall(() => supabase
		.from("ultimate_beneficial_owners")
		.select('*')
		.eq("user_id", userId)
		.eq("is_primary", true)
		.maybeSingle()
	);

	if (uboError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, uboError.message, uboError);
	if (!primaryUbo) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "Primary UBO not found");

	// Get user kyc data regardless of type bc we need the ip_address at minimum
	const { data: userKycData, error: userKycError } = await supabaseCall(() => supabase
		.from("user_kyc")
		.select('legal_first_name, legal_last_name, date_of_birth, ip_address')
		.eq("user_id", userId)
		.maybeSingle()
	);


	if (userKycError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, userKycError.message, userKycError);
	if (!userKycData) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "User kyc record not found");

	let requestBody = {
		firstName: primaryUbo.legal_first_name,
		lastName: primaryUbo.legal_last_name,
		dateOfBirth: primaryUbo.date_of_birth ? formatDate(primaryUbo.date_of_birth) : undefined,
		ipAddress: userKycData.ip_address
	};


	// Perform the KYC submission
	const url = `${BASTION_URL}/v1/users/${`${userId}-${type}`}/kyc`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(requestBody)
	};

	const response = await fetch(url, options);
	return response;
};

const submitKycDataIndividual = async (userId, type, bastionUserId) => {

	// Get user kyc data regardless of type bc we need the ip_address at minimum
	const { data: userKycData, error: userKycError } = await supabaseCall(() => supabase
		.from("user_kyc")
		.select('legal_first_name, legal_last_name, date_of_birth, ip_address')
		.eq("user_id", userId)
		.maybeSingle()
	);


	if (userKycError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, userKycError.message, userKycError);
	if (!userKycData) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "User kyc record not found");

	let requestBody = {
		firstName: userKycData.legal_first_name,
		lastName: userKycData.legal_last_name,
		dateOfBirth: formatDate(userKycData.date_of_birth),
		ipAddress: userKycData.ip_address
	};


	// Perform the KYC submission
	const url = `${BASTION_URL}/v1/users/${bastionUserId}/kyc`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(requestBody)
	};

	const response = await fetchWithLogging(url, options);
	return response;
};



// Helper function to format the date
function formatDate(dateString) {
	const birthDate = new Date(dateString);
	return `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`;
}


const submitBastionKycForDeveloper = async (userId, type, bastionUserId=undefined) => {
	try {
		const _bastionUserId = bastionUserId || `${userId}-${type}`
		const response = await submitKycDataIndividual(userId, type, _bastionUserId)
		const responseBody = await response.json();

		if (response.ok) {
			const { error: newBastionUserError } = await supabaseCall(() => supabase
				.from('bastion_users')
				.upsert(
					{
						user_id: userId,
						bastion_user_id: _bastionUserId,
						kyc_response: responseBody,
						kyc_passed: responseBody.kycPassed,
						jurisdiction_check_passed: responseBody.jurisdictionCheckPassed,
						kyc_level: responseBody.kycLevel
					},{onConflict: "bastion_user_id"}
				)
				.select()
			)

			if (newBastionUserError) throw new submitBastionKycError(submitBastionKycErrorType.INVALID_FIELD, newBastionUserError.message, newBastionUserError)
			if (responseBody.kycPassed === false) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, 'This region is not supported by HIFI at this time', "")
			return
		} else if (response.status == 400 && response.message == "KYC data for this user has already been submitted") {
			// FIXME need a way to get user submitted information
			return
		} else {
			throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, response.message, responseBody)
		}

	} catch (error) {
		await createLog("user/util/submitBastionKyc", userId, error.message, error)
		return
	}

}

module.exports = submitBastionKycForDeveloper