const transferFromPlaidToBridge = require("../transfer/transferFromPlaidToBridge")

const FiatToCryptoSupportedPairFunctionsCheck = (sourceCurrency, destinationChain, destinationCurrency) => {
    try{
        return FiatToCryptoSupportedPairFunctions[sourceCurrency][destinationChain][destinationCurrency]
    }catch (error){
        return null
    }
}

const FiatToCryptoSupportedPairFunctions = {
    usd:{
        POLYGON_AMOY: {
            usdc: transferFromPlaidToBridge
        },
        ETHEREUM_MAINNET: {
            usdc: transferFromPlaidToBridge,
            usdt: transferFromPlaidToBridge
        },
        POLYGON_MAINNET: {
            usdc: transferFromPlaidToBridge,
        },
        OPTIMISM_MAINNET: {
            usdc: transferFromPlaidToBridge
        },
        BASE_MAINNET: {
            usdc: transferFromPlaidToBridge
        }
    }
}

module.exports = FiatToCryptoSupportedPairFunctionsCheck