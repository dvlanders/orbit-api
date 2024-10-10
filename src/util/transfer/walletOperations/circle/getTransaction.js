const { getCircleTransaction } = require("../../../circle/endpoint/getCircleTransaction")
const { updateCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { safeParseBody } = require("../../../utils/response")

const getTransaction = async (config) => {
    const {transactionId, providerRecordId} = config;
    const response = await getCircleTransaction(transactionId);
    const responseBody = await safeParseBody(response);

    const toUpdate = {
        circle_response: responseBody
    }

    if (response.ok){
        toUpdate.circle_status = responseBody.data.state
        toUpdate.circle_transaction_id = responseBody.data.id
    }else{
        toUpdate.circle_status = "NOT_INITIATED"
    }

    await updateCircleTransactionRecord(providerRecordId, toUpdate)
    return {response, responseBody}
}

module.exports = {
    getTransaction
}