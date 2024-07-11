const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { reSendMessage, sendMessage } = require("../../webhooks/sendWebhookMessage")

const dayAfterCreated = 3


const pollWebhookRetry = async() => {
    // get all the queued message that has next_retry smaller than currenct time and sort in asceding order
    const now = new Date()
    let { data: webhookQueue, error } = await supabase
    .from('webhook_queue')
    .delete()
    .lt('next_retry', now.toISOString())
    .gt('first_retry', new Date(now.getTime() - dayAfterCreated * 24 * 60 * 60 * 1000).toISOString())
    .select("*")
    .order('next_retry', {ascending: true})

    if (error) {
        await createLog("pollWebhookRetry", "", error.message)
        return
    }

    await Promise.all(webhookQueue.map(async(message) => await sendMessage(message.profile_id, message.request_body, message.number_of_retries, message.first_retry)))
        
}

module.exports = pollWebhookRetry