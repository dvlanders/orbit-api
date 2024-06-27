const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");
const { submitKycData } = require("../endpoints/submitKycData");

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
		const response = await submitKycData(userId)
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

			if (responseBody.jurisdictionCheckPassed) {
				return {
					status: 200,
					walletStatus: CustomerStatus.ACTIVE,
					invalidFileds: [],
					actions: [],
					message: ""
				}
			} else {
				return {
					status: 200,
					walletStatus: CustomerStatus.INACTIVE,
					invalidFileds: ["ip_address"],
					actions: ["update"],
					message: "This region (ip address) is not supported by HIFI at this time"
				}
			}

		} else if (response.status == 400 && response.message == "KYC data for this user has already been submitted") {
			// FIXME need bastion to update endpoint
			return {
				status: 200,
				walletStatus: CustomerStatus.ACTIVE,
				invalidFileds: [],
				actions: [],
				message: ""
			}
		} else {
			throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, response.message, responseBody)
		}

	} catch (error) {
		createLog("user/util/submitBastionKyc", userId, error.message, error)
		return {
			status: 500,
			walletStatus: CustomerStatus.INACTIVE,
			invalidFileds: [],
			actions: [],
			message: "unexpected error happened when creating user wallet or during compliance checks, please contact hifi for more information"
		}
	}

}

module.exports = submitBastionKyc