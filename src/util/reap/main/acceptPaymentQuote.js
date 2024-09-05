const getUserReapApiCred = require("../utils/getUserApiCred")

const acceptPaymentQuote = async(paymentId, userId) => {
    const url = `${process.env.REAP_URL}/payments/${paymentId}/action`
    const {apiKey, entityId} = await getUserReapApiCred(userId)
    const headers = {
        "accept": "application/json",
        "content-type": "application/json;schema=PAAS",
        "x-reap-api-key": apiKey,
        "x-reap-entity-id": entityId
    }
    const requestBody = {
        type: "payment",
        action: "accept_quote"
    }

    const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(requestBody)
    })

    return response

}

module.exports = acceptPaymentQuote