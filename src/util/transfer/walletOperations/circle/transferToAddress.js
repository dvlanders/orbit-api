const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { insertSingleCircleTransactionRecord, updateCircleTransactionRecord, getCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { erc20TransferWithFunctionName } = require("../../../smartContract/utils/erc20")
const { safeParseBody } = require("../../../utils/response")
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits")
const { statusMapCircle } = require("./statusMap")

const transferToAddressCircle = async(config) => {
    const {referenceId, senderCircleWalletId, currency, unitsAmount, chain, destinationAddress, transferType, providerRecordId} = config
    const currencyContract = currencyContractAddress[chain][currency]
    const transferFunction = erc20TransferWithFunctionName(currency, destinationAddress, unitsAmount)

    // get provider record
    const providerRecord = await getCircleTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    const response = await submitTransactionCircle(referenceId, requestId, senderCircleWalletId, currencyContract, transferFunction.functionName, transferFunction.params)
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

    const statusMapping = statusMapCircle[transferType]
    const mainTableStatus = statusMapping[toUpdate.circle_status]

    return {providerRecordId: providerRecord.id, response, responseBody, mainTableStatus, providerStatus: toUpdate.circle_status, failedReason}

} 

module.exports = {
    transferToAddressCircle
}