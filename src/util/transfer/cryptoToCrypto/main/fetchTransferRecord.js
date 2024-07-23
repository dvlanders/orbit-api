const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferType } = require("../../utils/transfer")
const { fetchFiatToCryptoRequestInfortmaionById, fetchCryptoToCryptoRequestInfortmaionById } = require("../utils/fetchRequestInformation")

const fetchCryptoToCryptoTransferRecord = async(id, profileId) => {
    // get transactio record
    const record = await fetchCryptoToCryptoRequestInfortmaionById(id, profileId)
    if (!record) return null
        
    const result =  {
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
            failedReason: record.failed_reason,
            recipient: record.recipient?.user_kyc,
            sender: record.sender.user_kyc,
            fee: record.developer_fees ? {
                feeId: record.developer_fees.id,
                feeType: record.developer_fees.fee_type,
                feeAmount: record.developer_fees.fee_amount,
                feePercent: record.developer_fees.fee_percent,
                status: record.developer_fees.charged_status,
                transactionHash: record.developer_fees.transaction_hash,
                failedReason: record.developer_fees.failed_reason
            } : null
        }
    }

    return result
}

module.exports = fetchCryptoToCryptoTransferRecord