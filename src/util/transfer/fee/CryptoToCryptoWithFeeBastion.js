const { v4 } = require("uuid");
const { transfer } = require("../../bastion/endpoints/transfer");
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const { currencyContractAddress, currencyDecimal } = require("../../common/blockchain");
const { toUnitsString } = require("../cryptoToCrypto/utils/toUnits");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { updateFeeRecord } = require("./updateFeeRecord");
const { updateRequestRecord } = require("../cryptoToCrypto/main/updateRequestRecord");
const { transferType } = require("../utils/transfer");
const { insertFeeRecord } = require("./insertFeeRecord");

const chargedStatusMap = {
    ACCEPTED: "SUBMITTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "CONFIRMED",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

exports.CryptoToCryptoWithFeeBastion = async(requestRecord, paymentProcessorContractAddress, feeType, feePercent, feeAmount, profileId, fields) => {
    let feeRecordId
    try{
        // get fee_collection_user_id
        const {data: feeCollectionUser, error: feeCollectionUserError} = await supabase
            .from("profiles")
            .select("developer_user_id")
            .eq("id", profileId)
            .single()

        if (feeCollectionUserError) throw feeCollectionUserError
        if (!feeCollectionUser.developer_user_id) throw new Error("Developer user account is not created")

        // get fee_collection_wallet_address
		const feeCollectionWalletAddress = await getBastionWallet(feeCollectionUser.developer_user_id, fields.chain, "FEE_COLLECTION")
		if (!feeCollectionWalletAddress) throw new Error (`No feeCollectionWalletAddress wallet found`)
        const decimals = currencyDecimal[fields.currency]
        const feeUnitAmount = toUnitsString(feeAmount, decimals)

        // insert fee record
        const record = {
            fee_type: feeType,
            fee_percent: feePercent,
            fee_amount: feeAmount,
            charged_user_id: fields.senderUserId,
            fee_collection_user_id: feeCollectionUser.developer_user_id,
            fee_collection_wallet_address: feeCollectionWalletAddress,
            fee_collection_chain: fields.chain,
            fee_collection_currency: fields.currency,
            crypto_provider: "BASTION",
            charged_status: "CREATED",
            charged_transfer_id: requestRecord.id,
            charged_transfer_type: transferType.CRYPTO_TO_CRYPTO,
            charged_wallet_address: fields.senderAddress,
        }
        
        const feeRecord = await insertFeeRecord(record)
        feeRecordId = feeRecord.id
        
        // transfer
        const bodyObject = {
            requestId: requestRecord.bastion_request_id,
            userId: fields.senderUserId,
            contractAddress: paymentProcessorContractAddress,
            actionName: "processPayment",
            chain: fields.chain,
            actionParams: [
                {name: "token", value: fields.contractAddress},
                {name: "to", value: fields.recipientAddress},
                {name: "feeWallet", value: feeCollectionWalletAddress},
                {name: "amount", value: fields.unitsAmount},
                {name: "fee", value: feeUnitAmount},
            ]
        };

        const response = await submitUserAction(bodyObject)
        const responseBody = await response.json()
        let feeToUpdate
        let transferToUpdate
        
        if (response.ok){
            // update fee record
            feeToUpdate = {
                bastion_response: responseBody,
                bastion_status: responseBody.status,
                charged_status: chargedStatusMap[responseBody.status] || "UNKNOWN",
                transaction_hash: responseBody.transactionHash,
                failed_reason: responseBody.failureDetails
            }

            // update transfer record
            transferToUpdate = {
                bastion_response: responseBody,
                status: responseBody.status,
                transaction_hash: responseBody.transactionHash,
                failed_reason: responseBody.failureDetails,
                developer_fee_id: feeRecord.id
            }
            
        }else{
            createLog("transfer/fee/CryptoToCryptoWithFeeBastion", fields.senderUserId, responseBody.message, responseBody)
            // update fee record
            feeToUpdate = {
                bastion_response: responseBody,
                bastion_status: "FAILED",
                charged_status: "FAILED",
            }

            // update transfer record
            transferToUpdate = {
                bastion_response: responseBody,
                status: "FAILED",
                developer_fee_id: feeRecord.id
            }
            if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
                feeToUpdate.failed_reason = "Transfer amount exceeds balance"
                transferToUpdate.failed_reason = "Transfer amount exceeds balance"
            }else if (responseBody.message == "gas required exceeds allowance (7717)"){
                feeToUpdate.failed_reason = "Not enough gas, please contact HIFI for more information"
                transferToUpdate.failed_reason = "Not enough gas, please contact HIFI for more information"
            }else{
                feeToUpdate.failed_reason = "Please contact HIFI for more information"
                transferToUpdate.failed_reason = "Please contact HIFI for more information"
            }
        }

        // update record
        const updatedFeeRecord = await updateFeeRecord(feeRecord.id, feeToUpdate)
        const updatedTransferRecord = await updateRequestRecord(requestRecord.id, transferToUpdate)

        const receipt =  {
            transferType: transferType.CRYPTO_TO_CRYPTO,
            transferDetails: {
                id: updatedTransferRecord.id,
                requestId: fields.requestId,
                senderUserId: fields.senderUserId,
                recipientUserId: fields.recipientUserId || null,
                recipientAddress: fields.recipientAddress,
                chain: fields.chain,
                currency: fields.currency,
                amount: fields.amount,
                transactionHash: updatedTransferRecord.transaction_hash,
                createdAt: updatedTransferRecord.created_at,
                updatedAt: updatedTransferRecord.updated_at,
                status: updatedTransferRecord.status,
                contractAddress: fields.contractAddress,
                failedReason: updatedTransferRecord.failed_reason,
                fee: {
                    feeId: updatedFeeRecord.id,
                    feeType,
                    feeAmount,
                    feePercent,
                    status: updatedFeeRecord.charged_status,
                    transactionHash: updatedFeeRecord.transaction_hash,
                    failedReason: updatedFeeRecord.failed_reason
                },
            }
        }

        return receipt

    }catch (error){
        createLog("transfer/fee/CryptoToCryptoWithFeeBastion", fields.senderUserId, error.message)
        // update fee record
        const feeToUpdate = {
            bastion_status: "FAILED",
            charged_status: "FAILED",
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        // update transfer record
        const transferToUpdate = {
            status: "FAILED",
            developer_fee_id: feeRecordId,
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        // update record
        if (feeRecordId) {
            const updatedFeeRecord = await updateFeeRecord(feeRecordId, feeToUpdate)
        }
        const updatedTransferRecord = await updateRequestRecord(requestRecord.id, transferToUpdate)
        const receipt =  {
            transferType: transferType.CRYPTO_TO_CRYPTO,
            transferDetails: {
                id: requestRecord.id,
                requestId: fields.requestId,
                senderUserId: fields.senderUserId,
                recipientUserId: fields.recipientUserId || null,
                recipientAddress: fields.recipientAddress,
                chain: fields.chain,
                currency: fields.currency,
                amount: fields.amount,
                transactionHash: null,
                createdAt: updatedTransferRecord.created_at,
                updatedAt: updatedTransferRecord.updated_at,
                status: "FAILED",
                contractAddress: fields.contractAddress,
                failedReason: "Unexpected error happened, please contact HIFI for more information",
                fee: {
                    feeId: feeRecordId,
                    feeType,
                    feeAmount,
                    feePercent,
                    status: "FAILED",
                    transactionHash: null,
                    failedReason: "Unexpected error happened, please contact HIFI for more information",
                },
            }
        }

        return receipt
    }

}