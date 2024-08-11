const fetchBridgeCryptoToFiatTransferRecord = require("../transfer/fetchBridgeCryptoToFiatTransferRecordV2")


const FetchCryptoToBankSupportedPairCheck = (cryptoProvider, fiatProvider) => {
    try {
        return FetchCryptoToBankSupportedPairFunctions[cryptoProvider][fiatProvider]
    }catch (error){
        return null
    }
}

const FetchCryptoToBankSupportedPairFunctions = {
   BASTION:{
    BRIDGE: fetchBridgeCryptoToFiatTransferRecord
   }
}

module.exports = {
    FetchCryptoToBankSupportedPairCheck,
}