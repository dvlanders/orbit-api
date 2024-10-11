const { getCircleTransaction } = require("../../../circle/endpoint/getCircleTransaction")
const { safeParseBody } = require("../../../utils/response")

const getTransaction = async (config) => {
    const {transactionId} = config;
    const response = await getCircleTransaction(transactionId);
    const responseBody = await safeParseBody(response);
    return {response, responseBody}
}

module.exports = {
    getTransaction
}