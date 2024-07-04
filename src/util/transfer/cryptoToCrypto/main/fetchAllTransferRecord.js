const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { transferType } = require("../../utils/transfer");

const filledInfo = (record) => {
    return {
        transferType: transferType.CRYPTO_TO_CRYPTO,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            senderUserId: record.sender_user_id,
            recipientUserId: record.recipient_user_id,
            recipientAddress: record.recipient_address,
            chain: record.chain,
            currency: record.currency,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            contractAddress: record.contract_address,
        }
    }
}

const fetchAllCryptoToCryptoTransferRecord = async (profileId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    if (userId) {
        const {data: records, error} = await supabaseCall(() => supabase
            .from("crypto_to_crypto")
            .select("*")
            .eq("sender_user_id", userId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", {ascending: false})
            .limit(limit))
        if (error) throw error
        const info = records.map((record) => filledInfo(record))
        return {count: info.length, records: info}
    }else {
        const {data: records, error} = await  supabase
            .from("crypto_to_crypto")
            .select("*, users: sender_user_id!inner(id, profile_id)")
            .eq("users.profile_id", profileId)
            .lt("created_at", createdBefore)
            .gt("created_at", createdAfter)
            .order("created_at", {ascending: false})
            .limit(limit)
        if (error) throw error
        const info = records.map((record) => filledInfo(record))
        return {count: info.length, records: info}
    }
}

module.exports = fetchAllCryptoToCryptoTransferRecord