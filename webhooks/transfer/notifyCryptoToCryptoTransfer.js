const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const fetchCryptoToCryptoTransferRecord = require("../../src/util/transfer/cryptoToCrypto/main/fetchTransferRecord")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")

const eventTypeMap = {
	"INDIVIDUAL": webhookEventType["TRANSFER.CRYPTO_TO_CRYPTO"],
	"FEE_COLLECTION": webhookEventType["DEVELOPER.WITHDRAW.FEE_COLLECTION.CRYPTO_TO_CRYPTO"]
}

const notifyCryptoToCryptoTransfer = async (record) => {
	// get profileId

	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.sender_user_id)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyCryptoToCryptoTransfer", record.sender_user_id, userError.message)
		return
	}

	const receipt = await fetchCryptoToCryptoTransferRecord(record.id, user.profile_id)



	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: eventTypeMap[record.transfer_from_wallet_type],
		data: receipt
	}

	await sendMessage(user.profile_id, message)
}


module.exports = notifyCryptoToCryptoTransfer