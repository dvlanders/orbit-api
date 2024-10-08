const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const checkIsBridgingRequestIdAlreadyUsed = async(requestId, profileId) => {
    // insert new record
    let { data: newRecord, error:insertError } = await supabaseCall(() => supabase
        .from('bridging_transactions')
        .upsert({
            request_id: requestId,
        }, {onConflict: "request_id", ignoreDuplicates: true})
        .select("*")
        .maybeSingle())
    
    // record already exists
    if (insertError) throw insertError

    // new record
    return {isAlreadyUsed: !newRecord, newRecord: newRecord}
}

module.exports = {
    checkIsBridgingRequestIdAlreadyUsed
}