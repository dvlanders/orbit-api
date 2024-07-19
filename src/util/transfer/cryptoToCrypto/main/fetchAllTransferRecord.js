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
            amount: record.amount,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            contractAddress: record.contract_address,
            sender: record.sender_user.user_kyc,
            recipient: record.recipient_user?.user_kyc,
            failedReason: record.failed_reason
        }
    }
}

const fetchAllCryptoToCryptoTransferRecord = async (profileId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    if (userId) {
        const {data: records, error} = await supabaseCall(() => supabase
            .from("crypto_to_crypto")
            .select("*, sender_user: sender_user_id!inner(id, profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), recipient_user: recipient_user_id(id, profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email))")
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
            .select("*, sender_user: sender_user_id!inner(id, profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), recipient_user: recipient_user_id(id, profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email))")
            .eq("sender_user.profile_id", profileId)
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