const fetchCheckbookBridgeFiatToCryptoTransferRecord = require("../transfer/fetchCheckbookBridgeFiatToCryptoTransferRecord")
const fetchManualDepositBridgeFiatToCryptoTransferRecord = require("../transfer/fetchManualDepositBridgeFiatToCryptoTransferRecord")

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
    },
    MANUAL_DEPOSIT:{
        BRIDGE: fetchManualDepositBridgeFiatToCryptoTransferRecord
    }
}

module.exports = FiatToCryptoSupportedPairFetchFunctionsCheck