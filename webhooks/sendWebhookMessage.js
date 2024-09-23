const { timeStamp } = require("console");
const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const jwt = require("jsonwebtoken")
const { v4 } = require('uuid');
const insertWebhookMessageToQueue = require("./insertToQueue");
const insertToHistory = require("./insertToHistory");
const crypto = require('crypto');
const { safeParseBody } = require("../src/util/utils/response");


const sendMessage = async(profileId, requestBody, eventId=v4(), numberOfRetries=1, firstRetry=new Date(), insertToQueueIfFail=true) => {
    // prevent message send  in local development
    if (process.env.WEBHOOK_DISABLE && process.env.WEBHOOK_DISABLE === "TRUE") return
    
    //get client webhook url and secret
    let { data: webhookUrl, error: webhookUrlError } = await supabaseCall(() => supabase
        .from('webhook_urls')
        .select('webhook_url, webhook_signing_secret, enabled')
        .eq("profile_id", profileId)
        .maybeSingle())
    
    if (webhookUrlError) {
        await createLog("webhook/sendMessage", null, webhookUrlError.message, webhookUrlError, profileId)
        return
    }
    if (!webhookUrl || !webhookUrl.enabled) return
    const encryptedPrivateKey = webhookUrl.webhook_signing_secret.replace(/\\n/g, '\n')
    const passphrase = process.env.WEBHOOK_ENCRYPTION_SECRET
    if (!passphrase) throw new Error("No passphrase found")

    const privateKey = crypto.createPrivateKey({
        key: encryptedPrivateKey,
        format: 'pem',
        passphrase: passphrase,
      });
    
    // send message
    let response, responseBody, toSend, success
    try {
        toSend = {
            ...requestBody,
            eventId,
            timestamp: new Date().toISOString(),
        }
        // try sending the webhook message
        const token = jwt.sign(requestBody, privateKey, {
            algorithm: 'RS256',
            expiresIn: '1h'
          });
        response = await fetch(webhookUrl.webhook_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(toSend)
        })

        responseBody = await safeParseBody(response)

        if (!response.ok){
            // queue the message
            // insert record in queue
            if (insertToQueueIfFail) await insertWebhookMessageToQueue(profileId, requestBody, eventId, numberOfRetries, firstRetry)
            success = false
        }else{
            success = true
        }
        
    }catch (error){
        await createLog("webhook/sendMessage", null, error.message, error, profileId)
        // queue the message
        // insert record in queue
        if (insertToQueueIfFail) await insertWebhookMessageToQueue(profileId, requestBody, eventId, numberOfRetries, firstRetry)
        success = false
    }finally{
        // insert history
        await insertToHistory(profileId, toSend, eventId, response || {}, responseBody || {})
    }

    return success

}

module.exports = {
    sendMessage,
}