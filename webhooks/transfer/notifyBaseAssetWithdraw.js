const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const fetchBaseAssetTransactionRecord = require("../../src/util/transfer/baseAsset/fetchBaseAssetTransactionRecord")
const fetchCryptoToCryptoTransferRecord = require("../../src/util/transfer/cryptoToCrypto/main/fetchTransferRecord")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")


const notifyBaseAssetWithdraw = async (record) => {
	// get profileId

	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.sender_user_id)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyBaseAssetWithdraw", record.sender_user_id, userError.message)
		return
	}

	const receipt = await fetchBaseAssetTransactionRecord(record.id, user.profile_id)

	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: "DEVELOPER.WITHDRAW.GAS_STATION.BASE_ASSET",
		data: receipt
	}

	await sendMessage(user.profile_id, message)
}


module.exports = notifyBaseAssetWithdraw