const fetchBridgeCryptoToFiatTransferRecord = require("../transfer/fetchBridgeCryptoToFiatTransferRecord")


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