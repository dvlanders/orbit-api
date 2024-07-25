const { v4 } = require("uuid");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const { transferType } = require("../../utils/transfer");
const createLog = require("../../../logger/supabaseLogger");
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain");
const { updateFeeRecord } = require("../../fee/updateFeeRecord");

const chargedStatusMap = {
    ACCEPTED: "SUBMITTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "CONFIRMED",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

exports.chargeFeeBastion = async(requestRecord, feeRecord, paymentProcessorContractAddress, fields) => {
    try{    
        const feeUnitAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
        const tokenContractAddress = currencyContractAddress[feeRecord.fee_collection_chain][feeRecord.fee_collection_currency]
        // transfer
        const bodyObject = {
            requestId: feeRecord.request_id,
            userId: feeRecord.charged_user_id,
            contractAddress: paymentProcessorContractAddress,
            actionName: "processPayment",
            chain: feeRecord.fee_collection_chain,
            actionParams: [
                {name: "token", value: tokenContractAddress},
                {name: "to", value: fields.destinationWalletAddress},
                {name: "feeWallet", value: feeRecord.fee_collection_wallet_address},
                {name: "amount", value: fields.transferAmount},
                {name: "fee", value: feeUnitAmount},
            ]
        };

        const response = await submitUserAction(bodyObject)
        const responseBody = await response.json()
        let feeToUpdate
        
        if (response.ok){
            // update fee record
            feeToUpdate = {
                bastion_response: responseBody,
                bastion_status: responseBody.status,
                charged_status: chargedStatusMap[responseBody.status] || "UNKNOWN",
                transaction_hash: responseBody.transactionHash,
                failed_reason: responseBody.failureDetails
            }
            
        }else{
            await createLog("transfer/chargeFeeBastion", feeRecord.charged_user_id, responseBody.message, responseBody)
            // update fee record
            feeToUpdate = {
                bastion_response: responseBody,
                bastion_status: "FAILED",
                charged_status: "FAILED",
            }

            if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
                feeToUpdate.failed_reason = "Transfer amount exceeds balance"
            }else if (responseBody.message == "gas required exceeds allowance (7717)"){
                feeToUpdate.failed_reason = "Not enough gas, please contact HIFI for more information"
            }else{
                feeToUpdate.failed_reason = "Please contact HIFI for more information"
            }
        }

        // update record
        const updatedFeeRecord = await updateFeeRecord(feeRecord.id, feeToUpdate)
        return updatedFeeRecord
    }catch (error){
        await createLog("transfer/fee/chargeFeeBastion", feeRecord.charged_user_id, error.message)
        // update fee record
        const feeToUpdate = {
            bastion_status: "FAILED",
            charged_status: "FAILED",
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        const updatedFeeRecord = await updateFeeRecord(feeRecord.id, feeToUpdate)

        return updatedFeeRecord
    }

}