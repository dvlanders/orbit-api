const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { sendMessage } = require("../sendWebhookMessage");
const { webhookEventActionType, webhookEventType } = require("../webhookConfig");

const notifyReceiverStatusUpdate = async (userId, receiverId, status) => {

	// get profileId
	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id, is_developer')
		.eq("id", userId)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyReceiverStatusUpdate", userId, userError.message)
		return
	}

	if (user.is_developer) return

	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["RECEIVER.STATUS"],
		data: {
            receiverId: receiverId,
            kyc_status: status
        }
	}

	await sendMessage(user.profile_id, message)

}

module.exports = notifyReceiverStatusUpdate