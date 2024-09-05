const supabase = require("../../supabaseClient")
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../../transfer/cryptoToBankAccount/utils/createTransfer")
const createPaymentBody = require("../utils/createPaymentBody")
const getUserReapApiCred = require("../utils/getUserApiCred")

const createPaymentQuote = async(userId, accountId, paymentConfig) => {
    const {apiKey, entityId} = await getUserReapApiCred(userId)

    // create quote
    const url = `${process.env.REAP_URL}/payments`
    const headers = {
        "accept": "application/json",
        "content-type": "application/json;schema=PAAS",
        "x-reap-api-key": apiKey,
        "x-reap-entity-id": entityId
    }
    const requestBody = await createPaymentBody(paymentConfig, accountId)
    const options = {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
    }
    const response = await fetch(url, options)
    
    return response

}

module.exports = createPaymentQuote