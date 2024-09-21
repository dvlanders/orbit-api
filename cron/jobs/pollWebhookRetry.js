const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { reSendMessage, sendMessage } = require("../../webhooks/sendWebhookMessage")

const dayAfterCreated = 3

const deleteWebhookMessage = async(id) => {
    try{
        let { data: webhookQueue, error } = await supabase
        .from('webhook_queue')
        .delete()
        .eq("id", id)
        .single()
    
        if (error) throw error
    }catch (error){
        await createLog("webhook/deleteWebhookMessage", null, error.message, error)
        return
    }
}


const pollWebhookRetry = async() => {
    // get all the queued message that has next_retry smaller than currenct time and sort in asceding order
    const now = new Date()
    let { data: webhookQueue, error } = await supabase
    .from('webhook_queue')
    .update({
        processing: true
    })
    .lt('next_retry', now.toISOString())
    .eq("processing", false)
    .select("*")
    .order('next_retry', {ascending: true})

    if (error) {
        await createLog("pollWebhookRetry", null, error.message, error)
        return
    }

    await Promise.all(webhookQueue.map(async(message) => {
        if (new Date(message.first_retry) <= new Date(now.getTime() - dayAfterCreated * 24 * 60 * 60 * 1000)) {
            // exceed retyr limit
            await deleteWebhookMessage(message.id)
            return
        }
        await sendMessage(message.profile_id, message.request_body, message.event_id, message.number_of_retries, message.first_retry)
        await deleteWebhookMessage(message.id)
    }))
        
}

module.exports = pollWebhookRetry