const { updateCircleTransactionRecord, getCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction")
const { safeParseBody } = require("../../../utils/response");
const { statusMapCircle } = require("./statusMap");

const submitCircleUserAction = async(config) => {
    const {referenceId, senderCircleWalletId, actionName, actionParams, contractAddress, transferType, providerRecordId} = config;
    // get provider record
    const providerRecord = await getCircleTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    const response = await submitTransactionCircle(referenceId, requestId, senderCircleWalletId, contractAddress, actionName, actionParams)
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

    const mainStatusMapping = statusMapCircle[transferType]
    const mainTableStatus = mainStatusMapping[toUpdate.circle_status] || "UNKNOWN"

    return {response, responseBody, mainTableStatus};

} 

module.exports = {
    submitCircleUserAction
}