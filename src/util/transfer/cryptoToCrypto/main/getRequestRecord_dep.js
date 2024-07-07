const { getUserActions } = require("../../../bastion/endpoints/getUserAction");
const { BastionTransferStatus } = require("../../../bastion/utils/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { transferType } = require("../../utils/transfer");
const { updateRequestRecord } = require("./updateRequestRecord");

const getRequestRecord = async(requestRecord) => {
    const upToDateRequestRecord =  {
        transferType: transferType.CRYPTO_TO_CRYPTO,
        transferDetails: {
            id: requestRecord.id,
            requestId: requestRecord.request_id,
            senderUserId: requestRecord.sender_user_id,
            recipientUserId: requestRecord.recipient_user_id,
            recipientAddress: requestRecord.recipient_address,
            chain: requestRecord.chain,
            currency: requestRecord.currency,
            transactionHash: requestRecord.transaction_hash,
            createdAt: requestRecord.created_at,
            updatedAt: requestRecord.updated_at,
            status: requestRecord.status,
            contractAddress: requestRecord.contract_address,
        }
    }
    if (requestRecord.status != BastionTransferStatus.CONFIRMED || requestRecord.status != BastionTransferStatus.FAILED) {
        // get up to date response
        const response = await getUserActions(requestRecord.id, requestRecord.sender_user_id)
        const responseBody = await response.json()
        if (!response.ok) {
            createLog("transfer/util/getRequestRecord", requestRecord.sender_user_id, responseBody.message, responseBody)
            throw new Error("Something went wrong when getting request record")
        }
        // update to database
        toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
        }
        const record = await updateRequestRecord(requestRecord.id, toUpdate)
        upToDateRequestRecord.transferDetails.updatedAt = record.updated_at
        upToDateRequestRecord.transferDetails.status = record.status
    }

    return upToDateRequestRecord
}

module.exports = {
    getRequestRecord
}