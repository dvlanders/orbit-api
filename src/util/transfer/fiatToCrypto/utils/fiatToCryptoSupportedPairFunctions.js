const transferFromPlaidToBridge = require("../transfer/transferFromPlaidToBridge")

const FiatToCryptoSupportedPairFunctions = {
    "usd-usdc": {
        transferFunc: transferFromPlaidToBridge,
    }, 
}

module.exports = FiatToCryptoSupportedPairFunctions