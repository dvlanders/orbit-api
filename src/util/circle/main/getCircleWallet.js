const { currencyContractAddress } = require("../../common/blockchain")
const { toUnitsString } = require("../../transfer/cryptoToCrypto/utils/toUnits")
const { safeParseBody } = require("../../utils/response")
const { blockchainToCircleChain } = require("../utils/chainConvert")


const getCircleWalletBalance = async (walletId, chain, currency) => {
    const currencyContract = currencyContractAddress[chain][currency]
    const url = `${process.env.CIRCLE_WALLET_URL}/v1/w3s/wallets/${walletId}/balances?tokenAddress=${currencyContract}`
    const options = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CIRCLE_WALLET_API_KEY}`
        }
    }

    const response = await fetch(url, options)
    const responseBody = await safeParseBody(response)
    if (!response.ok) throw new Error(responseBody.message)

    const tokenInfo = responseBody.data.tokenBalances[0]
    const decimals = tokenInfo.token.decimals

    return {
        balance: toUnitsString(tokenInfo.amount, decimals),
        displayBalance: tokenInfo.amount,
        tokenInfo: {
            tokenAddress: tokenInfo.token.tokenAddress,
            standard: tokenInfo.token.standard,
            name: tokenInfo.token.name,
            symbol: tokenInfo.token.symbol,
            decimals: tokenInfo.token.decimals
        }
    }

}

module.exports = {
    getCircleWalletBalance
}