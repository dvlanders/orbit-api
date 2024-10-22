const { v4 } = require("uuid");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const { transferType } = require("../../utils/transfer");
const createLog = require("../../../logger/supabaseLogger");
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain");
const { updateFeeRecord } = require("../../fee/updateFeeRecord");
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction");
const { paymentProcessorProcessPaymentFunction } = require("../../../smartContract/utils/paymentProcessor");
const { safeParseBody } = require("../../../utils/response");
const { insertSingleCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService");

const chargedStatusMap = {
    "INITIATED": "SUBMITTED",
    "QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
	"CANCELED": "CANCELED",
	"FAILED": "FAILED",
	"DENIED": "FAILED",
	"ACCELERATED": "PENDING"
}

const chargeFeeCircle = async(requestRecord, feeRecord, paymentProcessorContractAddress, destinationWalletAddress, transferUnitAmount, circleWalletId) => {
    try{    
        const feeUnitAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
        const tokenContractAddress = currencyContractAddress[feeRecord.fee_collection_chain][feeRecord.fee_collection_currency]
        // transfer
        const processPaymentFunction = paymentProcessorProcessPaymentFunction(tokenContractAddress, destinationWalletAddress, feeRecord.fee_collection_wallet_address, transferUnitAmount, feeUnitAmount)

        
        const response = await submitTransactionCircle(feeRecord.id, feeRecord.request_id, circleWalletId, paymentProcessorContractAddress, processPaymentFunction.functionName, processPaymentFunction.params)
        const responseBody = await safeParseBody(response)
        let feeToUpdate

        if (response.ok){
            // insert to circle transaction record
            const circleTransactionRecord = {
                user_id: feeRecord.charged_user_id,
                request_id: feeRecord.request_id,
                circle_status: responseBody.data.state,
                circle_wallet_id: circleWalletId,
                circle_transaction_id: responseBody.data.id,
                circle_response: responseBody
            }

            const circleTransactionRecordInserted = await insertSingleCircleTransactionRecord(circleTransactionRecord)
            // update fee record
            feeToUpdate = {
                charged_status: chargedStatusMap[responseBody.data.state] || "UNKNOWN",
                circle_transaction_record_id: circleTransactionRecordInserted.id,
            }

        }else{
            await createLog("transfer/chargeFeeCircle", feeRecord.charged_user_id, responseBody.message, responseBody)
            // insert to circle transaction record
            const circleTransactionRecord = {
                user_id: feeRecord.charged_user_id,
                request_id: feeRecord.request_id,
                circle_status: "FAILED",
                circle_wallet_id: circleWalletId,
                circle_response: responseBody
            }
            const circleTransactionRecordInserted = await insertSingleCircleTransactionRecord(circleTransactionRecord)
            // update fee record
            feeToUpdate = {
                charged_status: "FAILED",
                circle_transaction_record_id: circleTransactionRecordInserted.id,
                failed_reason: "Please contact HIFI for more information"
            }
        }

        // update record
        const updatedFeeRecord = await updateFeeRecord(feeRecord.id, feeToUpdate)
        return updatedFeeRecord
    }catch (error){
        await createLog("transfer/fee/chargeFeeCircle", feeRecord.charged_user_id, error.message)
        // update fee record
        const feeToUpdate = {
            charged_status: "FAILED",
            failed_reason: "Unexpected error happened, please contact HIFI for more information",
        }

        const updatedFeeRecord = await updateFeeRecord(feeRecord.id, feeToUpdate)

        return updatedFeeRecord
    }

}
