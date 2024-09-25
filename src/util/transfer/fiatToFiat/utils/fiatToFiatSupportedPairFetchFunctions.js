const fetchCheckbookFiatToFiatTransferRecord = require("../transfer/fetchCheckbookFiatToFiatTransferRecord")

const FiatToFiatSupportedPairFetchFunctionsCheck = (fiatProvider, fiatReceiver) => {
    try{
        return FiatToFiatSupportedPairFetchFunctions[fiatProvider][fiatReceiver]
    }catch (error){
        return null
    }
}

const FiatToFiatSupportedPairFetchFunctions = {
    CHECKBOOK:{
        BANK: fetchCheckbookFiatToFiatTransferRecord
    },
}

module.exports = FiatToFiatSupportedPairFetchFunctionsCheck