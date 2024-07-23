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

const { transferType } = require("../utils/transfer");
const { insertFeeRecord } = require("./insertFeeRecord");
const { updateRequestRecord } = require("../cryptoToBankAccount/utils/updateRequestRecord");

const chargedStatusMap = {
    ACCEPTED: "SUBMITTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "CONFIRMED",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

exports.CryptoToFiatWithFeeBastion = async(requestRecord, paymentProcessorContractAddress, feeType, feePercent, feeAmount, profileId, fields) => {
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
        const decimals = currencyDecimal[fields.sourceCurrency]
        const feeUnitAmount = toUnitsString(feeAmount, decimals)

        // insert fee record
        const record = {
            fee_type: feeType,
            fee_percent: feePercent,
            fee_amount: feeAmount,
            charged_user_id: fields.sourceUserId,
            fee_collection_user_id: feeCollectionUser.developer_user_id,
            fee_collection_wallet_address: feeCollectionWalletAddress,
            fee_collection_chain: fields.chain,
            fee_collection_currency: fields.sourceCurrency,
            crypto_provider: "BASTION",
            charged_status: "CREATED",
            charged_transfer_id: requestRecord.id,
            charged_transfer_type: transferType.CRYPTO_TO_FIAT,
            charged_wallet_address: fields.sourceWalletAddress,
        }
        
        const feeRecord = await insertFeeRecord(record)
        feeRecordId = feeRecord.id
        
        // transfer
        const bodyObject = {
            requestId: requestRecord.bastion_request_id,
            userId: fields.sourceUserId,
            contractAddress: paymentProcessorContractAddress,
            actionName: "processPayment",
            chain: fields.chain,
            actionParams: [
                {name: "token", value: fields.contractAddress},
                {name: "to", value: fields.liquidationAddress},
                {name: "feeWallet", value: feeCollectionWalletAddress},
                {name: "amount", value: fields.transferAmount},
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

            const transaction_status = responseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN"

            // update transfer record
            transferToUpdate = {
                bastion_response: responseBody,
                bastion_transaction_status: responseBody.status,
                transaction_status,
                transaction_hash: responseBody.transactionHash,
                failed_reason: responseBody.failureDetails,
                developer_fee_id: feeRecord.id
            }
            
        }else{
            createLog("transfer/fee/CryptoToCryptoWithFeeBastion", fields.sourceUserId, responseBody.message, responseBody)
            // update fee record
            feeToUpdate = {
                bastion_response: responseBody,
                bastion_status: "FAILED",
                charged_status: "FAILED",
            }

            // update transfer record
            transferToUpdate = {
                bastion_response: responseBody,
                bastion_transaction_status: "FAILED",
                transaction_status: "NOT_INITIATED",
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
            transferType: transferType.CRYPTO_TO_FIAT,
            transferDetails: {
                id: updatedTransferRecord.id,
                requestId: updatedTransferRecord.request_id,
                sourceUserId: updatedTransferRecord.user_id,
                destinationUserId: updatedTransferRecord.destination_user_id,
                chain: updatedTransferRecord.chain,
                sourceCurrency: updatedTransferRecord.source_currency,
                amount: updatedTransferRecord.amount,
                status: updatedTransferRecord.transaction_status,
                destinationCurrency: updatedTransferRecord.destination_currency,
                destinationAccountId: fields.destinationAccountId,
                createdAt: updatedTransferRecord.created_at,
                updatedAt: updatedTransferRecord.updated_at,
                contractAddress: updatedTransferRecord.contract_address,
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
        createLog("transfer/fee/CryptoToFiatWithFeeBastion", fields.sourceUserId, error.message)
        // update fee record
        const feeToUpdate = {
            bastion_status: "FAILED",
            charged_status: "FAILED",
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        // update transfer record
        const transferToUpdate = {
            bastion_transaction_status: "FAILED",
            transaction_status: "NOT_INITIATED",
            developer_fee_id: feeRecordId,
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        // update record
        let updatedFeeRecord
        if (feeRecordId) {
            updatedFeeRecord = await updateFeeRecord(feeRecordId, feeToUpdate)
        }
        const updatedTransferRecord = await updateRequestRecord(requestRecord.id, transferToUpdate)
        const receipt =  {
            transferType: transferType.CRYPTO_TO_FIAT,
            transferDetails: {
                id: updatedTransferRecord.id,
                requestId: updatedTransferRecord.request_id,
                sourceUserId: updatedTransferRecord.user_id,
                destinationUserId: updatedTransferRecord.destination_user_id,
                chain: updatedTransferRecord.chain,
                sourceCurrency: updatedTransferRecord.source_currency,
                amount: updatedTransferRecord.amount,
                status: updatedTransferRecord.transaction_status,
                destinationCurrency: updatedTransferRecord.destination_currency,
                destinationAccountId: fields.destinationAccountId,
                createdAt: updatedTransferRecord.created_at,
                updatedAt: updatedTransferRecord.updated_at,
                contractAddress: updatedTransferRecord.contract_address,
                failedReason: updatedTransferRecord.failed_reason,
                fee: {
                    feeId: feeRecordId,
                    feeType,
                    feeAmount,
                    feePercent,
                    status: feeToUpdate.charged_status,
                    transactionHash: updatedFeeRecord ? updatedFeeRecord.transaction_hash : null,
                    failedReason: feeToUpdate.failed_reason
                },
            }
        }

        return receipt
    }

}