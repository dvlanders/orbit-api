const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { insertSingleCircleTransactionRecord, updateCircleTransactionRecord, getCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction")
const { currencyContractAddress } = require("../../../common/blockchain")
const { paymentProcessorProcessPaymentFunction } = require("../../../smartContract/utils/paymentProcessor")
const { safeParseBody } = require("../../../utils/response")
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits")
const { statusMapCircle } = require("./statusMap")

// transfer with payment processor
const transferToAddressCircleWithPP = async(config) => {
    const {referenceId, senderCircleWalletId, currency, unitsAmount, chain, destinationAddress, transferType, paymentProcessorContract, feeUnitsAmount, feeCollectionWalletAddress, providerRecordId} = config
    const tokenContractAddress = currencyContractAddress[chain][currency]
    const processPaymentFunction = paymentProcessorProcessPaymentFunction(tokenContractAddress, destinationAddress, feeCollectionWalletAddress, unitsAmount, feeUnitsAmount)

    // get provider record
    const providerRecord = await getCircleTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    const response = await submitTransactionCircle(referenceId, requestId, senderCircleWalletId, paymentProcessorContract, processPaymentFunction.functionName, processPaymentFunction.params)
    const responseBody = await safeParseBody(response)

    // update record in provider table
    const toUpdate = {
        circle_response: responseBody,
        updated_at: new Date().toISOString(),
        circle_wallet_id: senderCircleWalletId,
    }

    let failedReason
    if (response.ok){
        toUpdate.circle_status = responseBody.data.state
        toUpdate.circle_transaction_id = responseBody.data.id
    }else{
        toUpdate.circle_status = "NOT_INITIATED"
        const {message, type} = getMappedError(responseBody.message)
        failedReason = message
    }

    await updateCircleTransactionRecord(providerRecord.id, toUpdate)

    const mainStatusMapping = statusMapCircle[transferType]
    const feeRecordStatusMapping = statusMapCircle.FEE
    const mainTableStatus = mainStatusMapping[toUpdate.circle_status]
    const feeRecordStatus = feeRecordStatusMapping[toUpdate.circle_status]

    return {providerRecordId: providerRecord.id, response, responseBody, mainTableStatus, providerStatus: toUpdate.circle_status, failedReason, feeRecordStatus}

} 

module.exports = {
    transferToAddressCircleWithPP
}