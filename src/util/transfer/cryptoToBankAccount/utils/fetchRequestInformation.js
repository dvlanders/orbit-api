const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCryptoToFiatRequestInfortmaionById = async(id, profileId, fiatProvider, cryptoProvider) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('offramp_transactions')
            .select('*, source_user: user_id!inner(profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), destination_user: destination_user_id(user_kyc(legal_first_name, legal_last_name, business_name, compliance_email))')
            .eq("id", id)
            .eq("source_user.profile_id", profileId)
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