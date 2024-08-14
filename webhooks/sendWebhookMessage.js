const { timeStamp } = require("console");
const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const jwt = require("jsonwebtoken")
const { v4 } = require('uuid');
const insertWebhookMessageToQueue = require("./insertToQueue");
const insertToHistory = require("./insertToHistory");


const sendMessage = async(profileId, requestBody, numberOfRetries=1, firstRetry=new Date()) => {
    // prevent message send  in local development
    if (process.env.WEBHOOK_DISABLE && process.env.WEBHOOK_DISABLE === "TRUE") return
    
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
        await insertToHistory(profileId, toSend, eventId, response, responseBody)

        if (!response.ok){
            // queue the message
            // insert record in queue
            await insertWebhookMessageToQueue(profileId, requestBody, numberOfRetries, firstRetry)
        }
        
    }catch (error){
        await createLog("webhook/sendMessage", null, error.message, error, profileId)
        // queue the message
        // insert record in queue
        await insertWebhookMessageToQueue(profileId, requestBody, numberOfRetries, firstRetry)
    }

}

module.exports = {
    sendMessage,
}