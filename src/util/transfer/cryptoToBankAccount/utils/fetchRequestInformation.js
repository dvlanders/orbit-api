const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchCryptoToFiatRequestInfortmaionById = async(id, profileId, fiatProvider, cryptoProvider) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('offramp_transactions')
            .select('*, source_user: user_id!inner(profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), destination_user: destination_user_id(user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), developer_fees(id, fee_type, fee_amount, fee_percent, charged_status, transaction_hash, failed_reason)')
            .eq("id", id)
            .eq("source_user.profile_id", profileId)
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

const checkIsCryptoToFiatRequestIdAlreadyUsed = async(requestId, profileId) => {
    // insert new record
    let { data: newRecord, error:insertError } = await supabaseCall(() => supabase
        .from('offramp_transactions')
        .insert({
            request_id: requestId,
        })
        .select("*")
        .single())
    
    // record already exists
    if (insertError && (insertError.code == '23505' || insertError.message == 'duplicate key value violates unique constraint "offramp_transactions_request_id_key"')){
        return {isAlreadyUsed: true, newRecord: null}
    }

    // new record
    return {isAlreadyUsed: false, newRecord: newRecord}
}

module.exports = {
    fetchCryptoToFiatRequestInfortmaionById,
    fetchCryptoToFiatRequestInfortmaionByRequestId,
    checkIsCryptoToFiatRequestIdAlreadyUsed
}