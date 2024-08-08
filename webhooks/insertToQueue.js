const createLog = require("../src/util/logger/supabaseLogger")
const supabase = require("../src/util/supabaseClient")
const { supabaseCall } = require("../src/util/supabaseWithRetry")

const initialRetryInterval = 60 * 1000 // 60 secs
const maxRetryInterval = 3600 * 1000 // 1 hr

const insertWebhookMessageToQueue = async(profileId, requestBody, numberOfRetries, firstRetry) => {
    // insert failed record in queue
    const now = new Date()
    const jitter = Math.random() * Math.min(initialRetryInterval * numberOfRetries, maxRetryInterval)
    const { data: webhookQueue, error: webhookQueueError } = await supabaseCall(() => supabase
    .from('webhook_queue')
    .insert({
        request_body: requestBody,
        profile_id: profileId,
        next_retry: new Date(now.getTime() + jitter).toISOString(),
        number_of_retries: numberOfRetries + 1,
        first_retry: firstRetry
    })
    .select())

    if (webhookQueueError) {
        await createLog("webhook/sendMessage", null, webhookQueueError.message, webhookQueueError, profileId)
        return
    }
}

module.exports = insertWebhookMessageToQueue