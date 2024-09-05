const getUserReapApiCred = require("../utils/getUserApiCred")

const getReapPayment = async(paymentId, userId) => {
    const url = `${process.env.REAP_URL}/payments/${paymentId}`
    const {apiKey, entityId} = await getUserReapApiCred(userId)
    const headers = {
        "accept": "application/json",
        "content-type": "application/json;schema=PAAS",
        "x-reap-api-key": apiKey,
        "x-reap-entity-id": entityId
    }

    const response = await fetch(url, {headers})
    return response
}

module.exports = getReapPayment