const createLog = require("../src/util/logger/supabaseLogger")
const supabase = require("../src/util/supabaseClient")
const { supabaseCall } = require("../src/util/supabaseWithRetry")

const insertToHistory = async(profileId, requestBody, eventId, response, responseBody) => {
    // insert history
    const { data: webhookHistory, error: webhookHistoryError } = await supabaseCall(() => supabase
    .from('webhook_history')
    .insert({
        event_id: eventId,
        request_body: requestBody,
        profile_id: profileId,
        client_response: responseBody,
        client_response_status_code: response.status
    })
    .select()
    )
    if (webhookHistoryError) {
        await createLog("webhook/insertToHistory", null, webhookHistoryError.message, webhookHistoryError, profileId)
        return
    }
}

module.exports = insertToHistory