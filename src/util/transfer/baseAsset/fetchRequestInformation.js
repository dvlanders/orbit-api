const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")



const fetchBaseAssetTransactionInfortmaionById = async(id, profileId) => {
        let { data: request, error:requestError } = await supabaseCall(() => supabase
            .from('base_asset_transactions')
            .select('*, sender: sender_user_id!inner(profile_id)')
            .eq("id", id)
            .eq("sender.profile_id", profileId)
            .maybeSingle())
        

    if (requestError) throw requestError
    if (!request) return null

    return request
}

const fetchBaseAssetTransactionInfortmaionByRequestId = async(requestId) => {
    let { data: request, error:requestError } = await supabaseCall(() => supabase
        .from('base_asset_transactions')
        .select('*')
        .eq("request_id", requestId)
        .maybeSingle())
    


    if (requestError) throw requestError
    if (!request) return null

    return request
}

const checkIsBaseAssetTransactionRequestIdAlreadyUsed = async(requestId, profileId) => {
    // insert new record
    let { data: newRecord, error:insertError } = await supabaseCall(() => supabase
        .from('base_asset_transactions')
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

const fetchBaseAssetTransactionProvidersInformationById = async(id) => {

    const { data: record, error:recordError } = await supabaseCall(() => supabase
        .from('base_asset_transactions')
        .select('crypto_provider')
        .eq("id", id)
        .maybeSingle());

    if (recordError) throw recordError;
    return {fiatProvider: record?.fiat_provider, cryptoProvider: record?.crypto_provider};
}

module.exports = {
    fetchBaseAssetTransactionInfortmaionById,
    fetchBaseAssetTransactionInfortmaionByRequestId,
    checkIsBaseAssetTransactionRequestIdAlreadyUsed,
    fetchBaseAssetTransactionProvidersInformationById
}