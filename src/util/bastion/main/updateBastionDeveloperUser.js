const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const createAndFundBastionUser = require("./createAndFundBastionUser");
const { createBastionDeveloperWallet } = require("./createBastionUserForDeveloperUser");
const getBastionUser = require("./getBastionUser");
const submitBastionKyc = require("./submitBastionKyc");
const submitBastionKycForDeveloper = require("./submitBastionKycForDeveloperUser");

const UpdateBastionUserErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS"
};

class UpdateBastionUserError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, UpdateBastionUserError.prototype);
	}
}


const updateBastionDeveloperUser = async (userId) => {
	try {
		// NOTE: right now there is no way to update bastion information
		// Only check if the user Kyc is passed and wallets are created

		// check current user status
		// check is bastion user for PREFUNDED created
		let { data: bastionWalletsPrefunded, error: bastionWalletsPrefundedError } = await supabaseCall(() => supabase
			.from('bastion_wallets')
			.select('*')
			.eq("user_id", userId)
			.eq("type", "PREFUNDED")
		)
		if (bastionWalletsPrefundedError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionWalletsPrefundedError.message, bastionWalletsPrefundedError)
		if (!bastionWalletsPrefunded || bastionWalletsPrefunded.length <= 0) {
			await createBastionDeveloperWallet(userId, "PREFUNDED")
		}

		// check is bastion user for FEE_COLLECTION created
		let { data: bastionWalletsFee, error: bastionWalletsFeeError } = await supabaseCall(() => supabase
			.from('bastion_wallets')
			.select('*')
			.eq("user_id", userId)
			.eq("type", "FEE_COLLECTION")
		)
		if (bastionWalletsFeeError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionWalletsFeeError.message, bastionWalletsFeeError)
		if (!bastionWalletsFee || bastionWalletsFee.length <= 0) {
			await createBastionDeveloperWallet(userId, "FEE_COLLECTION")
		}

		// check is bastion kyc fro PREFUNDED wallet submitted
		let { data: bastionKycPrefunded, error: bastionKycPrefundedError } = await supabaseCall(() => supabase
			.from('bastion_users')
			.select('*')
			.eq("developer_user_id", `${userId}-PREFUNDED`)
			.maybeSingle())
		if (bastionKycPrefundedError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionKycPrefundedError.message, bastionKycPrefundedError)
		if (!bastionKycPrefunded) {
			await submitBastionKycForDeveloper(userId, "PREFUNDED")
		}


		// check is bastion kyc fro FEE_COLLECTION wallet submitted
		let { data: bastionKycFee, error: bastionKycFeeError } = await supabaseCall(() => supabase
			.from('bastion_users')
			.select('*')
			.eq("developer_user_id", `${userId}-FEE_COLLECTION`)
			.maybeSingle())
		if (bastionKycFeeError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionKycFeeError.message, bastionKycFeeError)
		if (!bastionKycFee) {
			await submitBastionKycForDeveloper(userId, "FEE_COLLECTION")
		}

	} catch (error) {
		await createLog("user/util/updateBastionDeveloperUser", userId, error.message, error)
		return {
			status: 500,
			walletStatus: CustomerStatus.INACTIVE,
			invalidFileds: [],
			actions: [],
			message: "unexpected error happened when creating developer user wallet or during compliance checks, please contact hifi for more information"
		}
	}

}

module.exports = updateBastionDeveloperUser