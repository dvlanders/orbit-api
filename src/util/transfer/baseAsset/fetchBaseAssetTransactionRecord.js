
const { formatEther } = require("ethers")
const { transferType } = require("../utils/transfer")
const { fetchBaseAssetTransactionInfortmaionByRequestId, fetchBaseAssetTransactionInfortmaionById } = require("./fetchRequestInformation")

const fetchBaseAssetTransactionRecord = async(recordId, profileId) => {
    const record = await fetchBaseAssetTransactionInfortmaionById(recordId, profileId)
    if (!record) throw new Error(`Record not found for recordId: ${recordId}`)
    
    const transactionResult = {
        transferType: transferType.BASE_ASSET,
        transferDetails: {
            id: record.id,
            amount: {
                wei: record.amount_in_wei,
                eth: record.amount
            },
            requestId: record.request_id,
            senderUserId: record.sender_user_id,
            recipientAddress: record.recipient_wallet_address,
            chain: record.chain,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
            failedReason: record.failed_reason
        }
    }

    return transactionResult
    
}

module.exports = fetchBaseAssetTransactionRecord