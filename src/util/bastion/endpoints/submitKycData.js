const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

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

const submitKycData = async (userId, bastionUserId) => {
	// Check user type
	const { data: userTypeData, error: userTypeError } = await supabaseCall(() => supabase
		.from("users")
		.select('user_type')
		.eq("id", userId)
		.maybeSingle()
	);

	if (userTypeError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, userTypeError.message, userTypeError);
	if (!userTypeData) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "User not found");

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
		dateOfBirth: userKycData.date_of_birth ? formatDate(userKycData.date_of_birth) : undefined,
		ipAddress: userKycData.ip_address
	};

	// If business user, replace the name and date of birth with the primary UBO's details
	if (userTypeData.user_type === 'business') {
		const { data: primaryUbo, error: uboError } = await supabaseCall(() => supabase
			.from("ultimate_beneficial_owners")
			.select('*')
			.eq("user_id", userId)
			.eq("is_primary", true)
			.maybeSingle()
		);

		if (uboError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, uboError.message, uboError);
		if (!primaryUbo) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "Primary UBO not found");

		requestBody.firstName = primaryUbo.legal_first_name;
		requestBody.lastName = primaryUbo.legal_last_name;
		requestBody.dateOfBirth = primaryUbo.date_of_birth ? formatDate(primaryUbo.date_of_birth) : undefined;
	}


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


module.exports = {
	submitKycData
}