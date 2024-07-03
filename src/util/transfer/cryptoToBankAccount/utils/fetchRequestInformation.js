const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCryptoToFiatRequestInfortmaionById = async(id, fiatProvider, cryptoProvider) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('offramp_transactions')
            .select('*')
            .eq("id", id)
            .eq("fiat_provider", fiatProvider)
            .eq("crypto_provider", cryptoProvider)
            .maybeSingle())
        

    if (requestError) throw requestError
    if (!request) return null

    return request
}

const fetchCryptoToFiatRequestInfortmaionByRequestId = async(requestId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('offramp_transactions')
        .select('*')
        .eq("request_id", requestId)
        .maybeSingle())
    


if (requestError) throw requestError
if (!request) return null

return request
}

const checkIsCryptoToFiatRequestIdAlreadyUsed = async(requestId, userId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('offramp_transactions')
        .select('*')
        .eq("request_id", requestId)
        .eq("user_id", userId)
        .maybeSingle())


    if (requestError) throw requestError
    if (!request) return null

    return request
}

module.exports = {
    fetchCryptoToFiatRequestInfortmaionById,
    fetchCryptoToFiatRequestInfortmaionByRequestId,
    checkIsCryptoToFiatRequestIdAlreadyUsed
}