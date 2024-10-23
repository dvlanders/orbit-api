const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("../utils/fiatToCryptoSupportedPairFetchFunctions");
const { transferObjectReconstructor } = require("../../utils/transfer");

// const fetchAllFiatToCryptoTransferRecord = async(profileId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
//     let allRecords
//     if (userId) {
//         const {data: records, error} = await supabaseCall(() => supabase
//             .from("onramp_transactions")
//             .select("id, fiat_provider, crypto_provider")
//             .eq("user_id", userId)
//             .lt("created_at", createdBefore)
//             .gt("created_at", createdAfter)
//             .order("created_at", {ascending: false})
//             .limit(limit))
//         if (error) throw error
//         allRecords = records
        
//     }else {
//         const {data: records, error} = await  supabase
//             .from("onramp_transactions")
//             .select("id, fiat_provider, crypto_provider, users: user_id!inner(id, profile_id)")
//             .eq("users.profile_id", profileId)
//             .lt("created_at", createdBefore)
//             .gt("created_at", createdAfter)
//             .order("created_at", {ascending: false})
//             .limit(limit)
//         if (error) throw error
//         allRecords = records
//     }

//     const info = await Promise.all(allRecords.map(async(record) => {
//         const func = FiatToCryptoSupportedPairFetchFunctionsCheck(record.crypto_provider, record.fiat_provider)
//         let result = await func(record.id, profileId)
//         result = await transferObjectReconstructor(result);
//         return result
//     }))
//     return {count: info.length, records: info}
// }

const fetchAllFiatToCryptoTransferRecord = async(profileId, extraQuery, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    const {userId, virtualAccountId} = extraQuery

    let query = supabase
        .from("onramp_transactions")
        .select("id, fiat_provider, crypto_provider, users: user_id!inner(id, profile_id), bridge_transaction_info: bridge_transaction_record_id(virtual_account_id)")
        .eq("users.profile_id", profileId)

    if (userId) query = query.eq("user_id", userId)
    if (virtualAccountId) query = query
                                    .eq("bridge_transaction_info.virtual_account_id", virtualAccountId)
                                    .eq("fiat_provider", "MANUAL_DEPOSIT")

    query = query
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)
        
    const {data: allRecords, error} = await supabaseCall(() => query)
    if (error) throw error
        

    const info = await Promise.all(allRecords.map(async(record) => {
        const func = FiatToCryptoSupportedPairFetchFunctionsCheck(record.crypto_provider, record.fiat_provider)
        let result = await func(record.id, profileId)
        result = await transferObjectReconstructor(result);
        return result
    }))
    return {count: info.length, records: info}
}


module.exports = fetchAllFiatToCryptoTransferRecord