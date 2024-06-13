const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

exports.updateRequestRecord = async(requestId, requestInfo) => {

    const { data, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .update({ 
        ...requestInfo,
        updated_at: new Date().toISOString(),
    },)
    .eq('request_id', requestId)
    .select("*")
    .single()
    )

    if (error) throw error
    return data
        
}