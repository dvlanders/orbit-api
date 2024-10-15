const { updateCircleTransactionRecord, getCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction")
const { currencyContractAddress } = require("../../../common/blockchain")
const { erc20ApproveWithFunctionName } = require("../../../smartContract/utils/erc20")
const { safeParseBody } = require("../../../utils/response")

const approveActionCircle = async(config) => {
    const {referenceId, senderCircleWalletId, currency, spender, unitsAmount, chain, providerRecordId} = config
    const currencyContract = currencyContractAddress[chain][currency]
    const approveFunction = erc20ApproveWithFunctionName(currency, spender, unitsAmount)

    // get provider record
    const providerRecord = await getCircleTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    const response = await submitTransactionCircle(referenceId, requestId, senderCircleWalletId, currencyContract, approveFunction.functionName, approveFunction.params)
    const responseBody = await safeParseBody(response)

    // update record in provider table
    const toUpdate = {
        circle_response: responseBody,
        circle_wallet_id: senderCircleWalletId,
    }

    if (response.ok){
        toUpdate.circle_status = responseBody.data.state
        toUpdate.circle_transaction_id = responseBody.data.id
    }else{
        toUpdate.circle_status = "NOT_INITIATED"
    }

    await updateCircleTransactionRecord(providerRecord.id, toUpdate)
    return {response, responseBody}

} 

module.exports = {
    approveActionCircle
}