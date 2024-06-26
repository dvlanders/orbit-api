const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchFiatToCryptoRequestInfortmaionById = async(id) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('onramp_transactions')
            .select('*')
            .eq("id", id)
            .maybeSingle())
        

    if (requestError) throw requestError
    if (!request) return null

    return request
}

const fetchFiatToCryptoRequestInfortmaionByRequestId = async(requestId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('onramp_transactions')
        .select('*')
        .eq("request_id", requestId)
        .maybeSingle())
    


if (requestError) throw requestError
if (!request) return null

return request
}

const checkIsFiatToCryptoRequestIdAlreadyUsed = async(requestId, userId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('onramp_transactions')
        .select('*')
        .eq("request_id", requestId)
        .eq("user_id", userId)
        .maybeSingle())


    if (requestError) throw requestError
    if (!request) return null

    return request
}

module.exports = {
    fetchFiatToCryptoRequestInfortmaionById,
    fetchFiatToCryptoRequestInfortmaionByRequestId,
    checkIsFiatToCryptoRequestIdAlreadyUsed
}