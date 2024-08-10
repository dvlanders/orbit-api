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
const { FetchCryptoToBankSupportedPairCheck } = require("../cryptoToBankAccount/utils/cryptoToBankSupportedPairFetchFunctions");

const chargedStatusMap = {
    ACCEPTED: "SUBMITTED",
    SUBMITTED: "SUBMITTED",
    CONFIRMED: "CONFIRMED",
    FAILED: "FAILED",
    PENDING: "PENDING"
}

exports.CryptoToFiatWithFeeBastion = async(requestRecord, feeRecord, paymentProcessorContractAddress, profileId) => {
    const decimals = currencyDecimal[requestRecord.source_currency]
	const transferUnitAmount = toUnitsString(requestRecord.amount, decimals)
    const feeRecordId = feeRecord.id
    try{
        const feeUnitAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
        // transfer
        const bodyObject = {
            requestId: requestRecord.bastion_request_id,
            userId: requestRecord.bastion_user_id,
            contractAddress: paymentProcessorContractAddress,
            actionName: "processPayment",
            chain: requestRecord.chain,
            actionParams: [
                {name: "token", value: requestRecord.contract_address},
                {name: "to", value: requestRecord.to_wallet_address},
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
            await createLog("transfer/fee/CryptoToCryptoWithFeeBastion", requestRecord.user_id, responseBody.message, responseBody)
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
        await updateFeeRecord(feeRecord.id, feeToUpdate)
        await updateRequestRecord(requestRecord.id, transferToUpdate)
        const fetchFunc = FetchCryptoToBankSupportedPairCheck(requestRecord.crypto_provider, requestRecord.fiat_provider)
        const receipt = await fetchFunc(requestRecord.id, profileId)

        return receipt

    }catch (error){
        await createLog("transfer/fee/CryptoToFiatWithFeeBastion", requestRecord.user_id, error.message)
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
        if (feeRecordId) {
            await updateFeeRecord(feeRecordId, feeToUpdate)
        }
        await updateRequestRecord(requestRecord.id, transferToUpdate)
        const fetchFunc = FetchCryptoToBankSupportedPairCheck(requestRecord.crypto_provider, requestRecord.fiat_provider)
        const receipt = await fetchFunc(requestRecord.id, profileId)

        return receipt
    }

}