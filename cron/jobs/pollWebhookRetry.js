const { v4 } = require("uuid")
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
        .select("*")
    
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
    .gt('first_retry', new Date(now.getTime() - dayAfterCreated * 24 * 60 * 60 * 1000).toISOString())
    .eq("processing", false)
    .select("*")
    .order('next_retry', {ascending: true})

    if (error) {
        await createLog("pollWebhookRetry", null, error.message, error)
        return
    }

    await Promise.all(webhookQueue.map(async(message) => {
        try{
            const eventId = message.event_id || message.request_body.eventId || v4()
            await sendMessage(message.profile_id, message.request_body, eventId, message.number_of_retries, message.first_retry)
            await deleteWebhookMessage(message.id)
        }catch(error){
            await createLog("pollWebhookRetry", null, error.message, error)
            return
        }
    }))
        
}

module.exports = pollWebhookRetry