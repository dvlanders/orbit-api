const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCryptoToCryptoRequestInfortmaionById = async(id, profileId) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('crypto_to_crypto')
            .select('*, sender: sender_user_id!inner(profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), recipient: recipient_user_id(user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), developer_fees(id, fee_type, fee_amount, fee_percent, charged_status, transaction_hash, failed_reason)')
            .eq("id", id)
            .eq("sender.profile_id", profileId)
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