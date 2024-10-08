const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const fetchBridgingTransactions = require("../../src/util/transfer/bridging/fetchBridgingTransactions")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")


const notifyBridgingUpdate = async (record) => {
	// get profileId
	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.source_user_id)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyBridgingUpdate", record.source_user_id, userError.message)
		return
	}

	const receipt = await fetchBridgingTransactions(record.id, user.profile_id)

	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: "BRIDGING.UPDATE",
		data: receipt
	}

	await sendMessage(user.profile_id, message)
}


module.exports = notifyBridgingUpdate