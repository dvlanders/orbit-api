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

const fetchCryptoToFiatProvidersInformationById = async(id) => {

    const { data: record, error:recordError } = await supabaseCall(() => supabase
        .from('offramp_transactions')
        .select('fiat_provider, crypto_provider')
        .eq("id", id)
        .maybeSingle());

    if (recordError) throw recordError;
    return {fiatProvider: record?.fiat_provider, cryptoProvider: record?.crypto_provider};
}

module.exports = {
    fetchCryptoToFiatRequestInfortmaionById,
    fetchCryptoToFiatRequestInfortmaionByRequestId,
    checkIsCryptoToFiatRequestIdAlreadyUsed,
    fetchCryptoToFiatProvidersInformationById
}