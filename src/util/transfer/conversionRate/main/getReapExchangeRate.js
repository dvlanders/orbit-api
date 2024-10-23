const createLog = require("../../../logger/supabaseLogger")
const getUserReapApiCred = require("../../../reap/utils/getUserApiCred")
const { fetchWithLogging } = require("../../../logger/fetchLogger")

const getReapExchangeRate = async (userId, fromCurrency, toCurrency) => {
    const {apiKey, entityId} = await getUserReapApiCred(userId)

    // create quote
    const url = `${process.env.REAP_URL}/exchange-rates?fromCurrency=${fromCurrency.toUpperCase()}&toCurrency=${toCurrency.toUpperCase()}`
    const headers = {
        "accept": "application/json",
        "content-type": "application/json;schema=PAAS",
        "x-reap-api-key": apiKey,
        "x-reap-entity-id": entityId
    }
    const options = {
        method: "GET",
        headers,
    }
    const response = await fetchWithLogging(url, options, "REAP")
    const responseBody = await response.json()
    if (!response.ok) {
        await createLog("reap/getReapExchangeRate", userId, responseBody.message, responseBody)
        throw new Error("Failed to get exchange rate from Reap")
    }else {
        return responseBody
    }
}

module.exports = getReapExchangeRate
