const { virtualAccountPaymentRailToChain } = require("../../src/util/bridge/utils")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const fetchBridgeCryptoToFiatTransferRecord = require("../../src/util/transfer/cryptoToBankAccount/transfer/fetchBridgeCryptoToFiatTransferRecord")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")


const notifyDeveloperCryptoToFiatWithdraw = async (record) => {

	// get profileId
	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.user_id)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyDeveloperCryptoToFiatWithdraw", record.user_id, userError.message)
		return
	}

	const receipt = await fetchBridgeCryptoToFiatTransferRecord(record.id, user.profile_id)

	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["DEVELOPER.WITHDRAW.FEE_COLLECTION.CRYPTO_TO_FIAT"],
		data: receipt
	}

	await sendMessage(user.profile_id, message)
	console.log("message sent")

}

module.exports = notifyDeveloperCryptoToFiatWithdraw