const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")

const notifyCryptoToCryptoTransfer = async (record) => {
	// get profileId

	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.sender_user_id)
		.single()
	)

	if (userError) {
		createLog("webhook/notifyCryptoToCryptoTransfer", record.sender_user_id, userError.message)
		return
	}

	const receipt = {
		transferType: transferType.CRYPTO_TO_CRYPTO,
		transferDetails: {
			id: record.id,
			requestId: record.requets_id,
			senderUserId: record.sender_user_id,
			recipientUserId: record.recipient_user_id,
			recipientAddress: record.recipient_address,
			chain: record.chain,
			currency: record.currency,
			amount: record.amount,
			transactionHash: record.transaction_hash,
			createdAt: record.created_at,
			updatedAt: record.updated_at,
			status: record.status,
			contractAddress: record.contract_address,
		}
	}

	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["TRANSFER.CRYPTO_TO_CRYPTO"],
		data: receipt
	}

	await sendMessage(user.profile_id, message)
	console.log("message sent")
}


module.exports = notifyCryptoToCryptoTransfer