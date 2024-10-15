const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
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

const _checkAndUpdateBastionWallet = async (userId, walletType) => {
	// create wallet if not exists
	let { data: bastionWallets, error: bastionWalletsError } = await supabaseCall(() => supabase
		.from('bastion_wallets')
		.select('*')
		.eq("user_id", userId)
		.eq("type", walletType)
	)
	if (bastionWalletsError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionWalletsError.message, bastionWalletsError)
	if (!bastionWallets || bastionWallets.length <= 0) {
		await createBastionDeveloperWallet(userId, walletType)
	}

	// check is bastion kyc for wallet submitted
	let { data: bastionKyc, error: bastionKycError } = await supabaseCall(() => supabase
		.from('bastion_users')
		.select('*')
		.eq("bastion_user_id", `${userId}-${walletType}`)
		.maybeSingle())
	if (bastionKycError) throw new UpdateBastionUserError(UpdateBastionUserErrorType.INTERNAL_ERROR, bastionKycError.message, bastionKycError)
	if (!bastionKyc) {
		await submitBastionKycForDeveloper(userId, walletType)
	}
}


const updateBastionDeveloperUser = async (userId, walletTypes) => {
	try {
		await Promise.all(walletTypes.map(async (walletType) => {
			await _checkAndUpdateBastionWallet(userId, walletType)
		}))
	} catch (error) {
		await createLog("user/util/updateBastionDeveloperUser", userId, error.message, error)
	}
}

module.exports = updateBastionDeveloperUser