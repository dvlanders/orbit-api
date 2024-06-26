const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCryptoToCryptoRequestInfortmaionById = async(id) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('crypto_to_crypto')
            .select('*')
            .eq("id", id)
            .maybeSingle())
        
    

    if (requestError) throw requestError
    if (!request) return null

    return request
}

const fetchCryptoToCryptoRequestInfortmaionByRequestId = async(requestId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('crypto_to_crypto')
        .select('*')
        .eq("request_id", requestId)
        .maybeSingle())
    


if (requestError) throw requestError
if (!request) return null

return request
}

const checkIsCryptoToCryptoRequestIdAlreadyUsed = async(requestId, senderUserId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('crypto_to_crypto')
        .select('*')
        .eq("request_id", requestId)
        .eq("sender_user_id", senderUserId)
        .maybeSingle())


    if (requestError) throw requestError
    if (!request) return null

    return request
}

module.exports = {
    fetchCryptoToCryptoRequestInfortmaionById,
    fetchCryptoToCryptoRequestInfortmaionByRequestId,
    checkIsCryptoToCryptoRequestIdAlreadyUsed
}