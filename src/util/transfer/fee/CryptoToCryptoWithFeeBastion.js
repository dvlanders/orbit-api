const { v4 } = require("uuid");
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

exports.CryptoToCryptoWithFeeBastion = async(requestRecord, feeRecord, paymentProcessorContractAddress, profileId) => {
    const feeRecordId = feeRecord.id
    try{    
        const feeUnitAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
        const decimals = currencyDecimal[requestRecord.currency]
        const transferUnitAmount = toUnitsString(requestRecord.amount, decimals)
        // transfer
        const bodyObject = {
            requestId: requestRecord.bastion_request_id,
            userId: requestRecord.sender_bastion_user_id,
            contractAddress: paymentProcessorContractAddress,
            actionName: "processPayment",
            chain: requestRecord.chain,
            actionParams: [
                {name: "token", value: requestRecord.contract_address},
                {name: "to", value: requestRecord.recipient_address},
                {name: "feeWallet", value: feeRecord.fee_collection_wallet_address},
                {name: "amount", value: transferUnitAmount},
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
            await createLog("transfer/fee/CryptoToCryptoWithFeeBastion", requestRecord.sender_user_id, responseBody.message, responseBody)
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
        await updateFeeRecord(feeRecord.id, feeToUpdate)
        const updatedTransferRecord = await updateRequestRecord(requestRecord.id, transferToUpdate)

        return updatedTransferRecord

    }catch (error){
        await createLog("transfer/fee/CryptoToCryptoWithFeeBastion", requestRecord.sender_user_id, error.message)
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
            await updateFeeRecord(feeRecordId, feeToUpdate)
        }
        const updatedTransferRecord = await updateRequestRecord(requestRecord.id, transferToUpdate)

        return updatedTransferRecord
    }

}