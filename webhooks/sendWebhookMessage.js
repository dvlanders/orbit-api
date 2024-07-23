const { timeStamp } = require("console");
const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const jwt = require("jsonwebtoken")
const { v4 } = require('uuid');
const initialRetryInterval = 60 * 1000 // 60 secs
const maxRetryInterval = 3600 * 1000 // 1 hr


const sendMessage = async(profileId, requestBody, numberOfRetries=1, firstRetry=new Date()) => {
    //get client webhook url and secret
    let { data: webhookUrl, error: webhookUrlError } = await supabaseCall(() => supabase
        .from('webhook_urls')
        .select('webhook_url, webhook_secret')
        .eq("profile_id", profileId)
        .maybeSingle())
    
    if (webhookUrlError) {
        await createLog("webhook/sendMessage", null, webhookUrlError.message, webhookUrlError, profileId)
        return
    }
    if (!webhookUrl) return

    try {
        const eventId = v4()
        const toSend = {
            eventId,
            timestamp: new Date().toISOString(),
            ...requestBody
        }
        // try sending the webhook message
        const token = jwt.sign(requestBody, webhookUrl.webhook_secret, { expiresIn: '1h' });
        const response = await fetch(webhookUrl.webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(toSend)
        })
        const responseBody = await response.json()

        // insert history
        const { data: webhookHistory, error: webhookHistoryError } = await supabaseCall(() => supabase
            .from('webhook_history')
            .insert({
                id: eventId,
                request_body: requestBody,
                profile_id: profileId,
                client_response: responseBody,
                client_response_status_code: response.status
            })
            .select()
        )
        if (webhookHistoryError) {
            await createLog("webhook/sendMessage", null, webhookHistoryError.message, webhookHistoryError, profileId)
            return
        }

        if (!response.ok){
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
        
    }catch (error){
        const now = new Date()
        const jitter = Math.random() * Math.min(initialRetryInterval * numberOfRetries, maxRetryInterval)
        await createLog("webhook/sendMessage", null, error.message, error, profileId)
        // queue the message
        // insert record in queue
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

}

module.exports = {
    sendMessage,
}