const getBastionUser = require("../../src/util/bastion/main/getBastionUser");
const getBridgeCustomer = require("../../src/util/bridge/endpoint/getBridgeCustomer");
const getCheckbookUser = require("../../src/util/checkbook/endpoint/getCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { CustomerStatus } = require("../../src/util/user/common");
const { getUserWalletStatus } = require("../../src/util/user/getUserWalletStatus");
const { sendMessage } = require("../sendWebhookMessage");
const { webhookEventActionType, webhookEventType } = require("../webhookConfig");
const { defaultKycInfo, updateKycInfo } = require("../../src/util/user/kycInfo");

const getUserStatus = async (userId, kycLevel) => {
	
	// get status
	const [walletResult, bridgeResult, checkbookResult] = await Promise.all([
		getUserWalletStatus(userId),
		getBridgeCustomer(userId, kycLevel),
		getCheckbookUser(userId)
	])

	const getHifiUserResponse = defaultKycInfo(userId, kycLevel);
	updateKycInfo(getHifiUserResponse, walletResult, bridgeResult, checkbookResult);

	// determine the status code to return to the client -- copied from createHifiUser, make sure this logic still holds true
	let status
	if (checkbookResult.status === 200 && bridgeResult.status === 200 && walletResult.status === 200) {
		status = 200
	} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || walletResult.status == 500) {
		status = 500;
	} else {
		status = 400;
	}

	return {status, getHifiUserResponse}
}

const notifyUserStatusUpdate = async (userId) => {

	// get profileId

	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id, is_developer, kyc_level')
		.eq("id", userId)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyUserStatusUpdate", userId, userError.message)
		return
	}

	if (user.is_developer) return

	const { status, getHifiUserResponse } = await getUserStatus(userId, user.kyc_level)
	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["USER.STATUS"],
		data: getHifiUserResponse
	}

	await sendMessage(user.profile_id, message)

}

module.exports = notifyUserStatusUpdate