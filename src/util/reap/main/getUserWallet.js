const createLog = require("../../logger/supabaseLogger")
const getUserReapApiCred = require("../utils/getUserApiCred")
const { chainToReapNetwork } = require("../utils/map")
const { fetchWithLogging } = require("../../logger/fetchLogger")

const getUserReapWalletAddress = async(userId, chain) => {
    const {apiKey, entityId} = await getUserReapApiCred(userId)
    const url = `${process.env.REAP_URL}/account-info`
    const headers = {
        "accept": "application/json",
        "content-type": "application/json;schema=PAAS",
        "x-reap-api-key": apiKey,
        "x-reap-entity-id": entityId
    }
    const response = await fetchWithLogging(url, {headers})
    const responseBody = await response.json()
    if (!response.ok){
        await createLog("reap/utils/getUserReapWalletAddress", userId, responseBody.message, responseBody)
        throw new Error("Failed to get user wallet from Reap")
    }

    const wallets = responseBody.wallets
    const wallet = wallets.find((wallet) => wallet.network == chainToReapNetwork[chain])

    if (!wallet && process.env.NODE_ENV != "development"){
        await createLog("reap/utils/getUserReapWalletAddress", userId, `No wallet found for user on chain ${chain}`)
        throw new Error(`No wallet found for user on chain ${chain}`)
    }
    if (!wallet && process.env.NODE_ENV == "development"){
        return "0x0000000000000000000000000000000000000000"
    }


    return wallet.address
}

module.exports = getUserReapWalletAddress