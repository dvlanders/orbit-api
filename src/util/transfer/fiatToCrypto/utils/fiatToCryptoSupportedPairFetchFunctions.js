const fetchCheckbookBridgeFiatToCryptoTransferRecord = require("../transfer/fetchCheckbookBridgeFiatToCryptoTransferRecord")

const FiatToCryptoSupportedPairFetchFunctionsCheck = (cryptoProvider, fiatProvider) => {
    try{
        return FiatToCryptoSupportedPairFetchFunctions[fiatProvider][cryptoProvider]
    }catch (error){
        return null
    }
}

const FiatToCryptoSupportedPairFetchFunctions = {
    CHECKBOOK:{
        BRIDGE: fetchCheckbookBridgeFiatToCryptoTransferRecord
    }
}

module.exports = FiatToCryptoSupportedPairFetchFunctionsCheck