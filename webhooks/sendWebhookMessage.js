const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const jwt = require("jsonwebtoken")

const sendMessage = async(profileId, requestBody) => {
    //get client webhook url and secret
    let { data: webhookUrl, error: webhookUrlError } = await supabaseCall(() => supabase
        .from('webhook_urls')
        .select('webhook_url, webhook_secret')
        .eq("profile_id", profileId)
        .maybeSingle())
    
    if (webhookUrlError) {
        createLog("webhook/sendMessage", "",webhookUrlError.message)
        return
    }
    if (!webhookUrl) return

    try {

        // try sending the webhook message
        const token = jwt.sign(requestBody, webhookUrl.webhook_secret, { expiresIn: '1h' });
        const response = await fetch(webhookUrl.webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        })
        const responseBody = await response.json()

        // insert history
        const { data: webhookHistory, error: webhookHistoryError } = await supabaseCall(() => supabase
            .from('webhook_history')
            .insert({
                request_body: requestBody,
                profile_id: profileId,
                client_response: responseBody,
                client_response_status_code: response.status
            })
            .select()
        )
        if (webhookHistoryError) {
            createLog("webhook/sendMessage", "",webhookHistoryError.message)
            return
        }

        if (!response.ok){
            // insert record in queue
            const { data: webhookQueue, error: webhookQueueError } = await supabaseCall(() => supabase
            .from('webhook_queue')
            .insert({
                request_body: requestBody,
                profile_id: profileId,
            })
            .select())

            if (webhookQueueError) {
                createLog("webhook/sendMessage", "",webhookQueueError.message)
                return
            }
        }
        
    }catch (error){
        createLog("webhook/sendMessage", "", error.message)
        // queue the message
        // insert record in queue
        const { data: webhookQueue, error: webhookQueueError } = await supabaseCall(() => supabase
        .from('webhook_queue')
        .insert({
            request_body: requestBody,
            profile_id: profileId,
        })
        .select())

        if (webhookQueueError) {
            createLog("webhook/sendMessage", "", webhookQueueError.message)
            return
        }
    }

}

const reSendMessage = async(requestId) => {
    // get message
    let { data: message, error: messageError } = await supabase
    .from('webhook_queue')
    .delete()
    .eq("id", requestId)
    .select('request_body, profile_id')
    .maybeSingle()

    if (messageError){
        createLog("webhook/reSendMessage", "",messageError.message)
        return
    }
    if (!message) {
        createLog("webhook/reSendMessage", "",`No record found for id: ${requestId}`)
        return
    }

    await sendMessage(message.profile_id, message.request_body)

}

module.exports = {
    sendMessage,
    reSendMessage
}