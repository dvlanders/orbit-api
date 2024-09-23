const createLog = require("../src/util/logger/supabaseLogger")
const supabase = require("../src/util/supabaseClient")
const { sendMessage } = require("./sendWebhookMessage")

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

const resendFromHistory = async(recordId, profileId) => {
    try{
        const { data: webhookMessage, error } = await supabase
        .from('webhook_history')
        .select("*")
        .eq("id", recordId)
        .maybeSingle()

        if (error) throw error
        if (!webhookMessage) return {error: {
            status: 404,
            message: "No webhook message found for recordId"
        }}

        const success = await sendMessage(profileId, webhookMessage.request_body, webhookMessage.event_id, 1, new Date(), false)
        if (!success) return

        // check if message is also in queue, delete if found
        const {data: webhookQueue, error: webhookQueueError} = await supabase
            .from("webhook_queue")
            .delete()
            .eq("event_id", webhookMessage.event_id)
            .eq("processing", false)
          
        return
    }catch (error){
        await createLog("webhook/resendFromHistory", null, error.message, error)
        throw new Error("Error happened in webhook/resendFromHistory")
    }
}

const resendFromQueue = async(recordId, profileId) => {
    try{
        const { data: webhookMessage, error } = await supabase
            .from('webhook_queue')
            .update({
                processing: true
            })
            .eq("id", recordId)
            .select("*")
            .maybeSingle()

        if (error) throw error
        if (!webhookMessage) return {error: {
            status: 404,
            message: "No webhook message found for recordId"
        }}

        await sendMessage(profileId, webhookMessage.request_body, webhookMessage.event_id)
        await deleteWebhookMessage(recordId)
        return
    }catch (error){
        await createLog("webhook/resendFromHistory", null, error.message, error)
        throw new Error("Error happened in webhook/resendFromHistory")
    }
}

module.exports = {
    resendFromHistory,
    resendFromQueue
}


