const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

exports.updateRequestRecord = async(requestId, requestInfo) => {

    const { data, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .update({ 
        updated_at: new Date().toISOString(),
        bastion_response: requestInfo.bastionResponse,
        status: requestInfo.status,
        transaction_hash: requestInfo.transactionHash
    },)
    .eq('request_id', requestId)
    .select("*")
    .single()
    )

    if (error) throw error
    return data
        
}