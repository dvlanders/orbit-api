const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

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

const submitBastionKyc = async (userId) => {
	try {
		// fetch user info
		const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
			.from("user_kyc")
			.select('legal_first_name, legal_last_name, ip_address, date_of_birth')
			.eq("user_id", userId)
			.maybeSingle()
		)

		if (userKycError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, userKycError.message, userKycError)
		if (!userKyc) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "user not found")

		const birthDate = userKyc.date_of_birth ? new Date(userKyc.date_of_birth) : undefined;
		const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`;

		const requestBody = {
			firstName: userKyc.legal_first_name,
			lastName: userKyc.legal_last_name,
			dateOfBirth: formattedBirthDate,
			ipAddress: userKyc.ip_address
		};

		const url = `${BASTION_URL}/v1/users/${userId}/kyc`;
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
		const responseBody = await response.json();

		if (response.ok) {
			const { error: newBastionUserError } = await supabaseCall(() => supabase
				.from('bastion_users')
				.upsert(
					{
						user_id: userId,
						kyc_response: responseBody,
						kyc_passed: responseBody.kycPassed,
						jurisdiction_check_passed: responseBody.jurisdictionCheckPassed,
						kyc_level: responseBody.kycLevel
					},
					{ onConflict: "user_id" }
				)
				.select()
			)

			if (newBastionUserError) throw new submitBastionKycError(submitBastionKycErrorType.INVALID_FIELD, newBastionUserError.message, newBastionUserError)
			if (responseBody.kycPassed === false) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, 'This region is not supported by HIFI at this time', "")

			return {
				status: 200,
				message: "wallet Kyc success",
				customerStatus: "active"
			}

		} else if (response.status == 400 && response.message == "KYC data for this user has already been submitted") {
			// FIXME need bastion to update endpoint
			const { data, error } = await supabaseCall(() => supabase
				.from('bastion_users')
				.upsert(
					{
						user_id: userId,
						kyc_response: null,
						kyc_passed: true,
						jurisdiction_check_passed: null,
						kyc_level: null
					},
					{ onConflict: "user_id" }
				)
				.select())
			return {
				status: 200,
				message: "wallet Kyc success",
				customerStatus: "active"
			}
		} else {
			throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, response.message, response)
		}

	} catch (error) {
		createLog("user/util/submitBastionKyc", userId, error.message, error)
		return {
			status: 500,
			message: "unexpected error happened when creating user wallet",
			customerStatus: "inactive"
		}
	}

}

module.exports = submitBastionKyc