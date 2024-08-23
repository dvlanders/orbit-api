const fetchBridgeCryptoToFiatTransferRecord = require("../transfer/fetchBridgeCryptoToFiatTransferRecordV2")
const fetchDirectBridgeCryptoToFiatTransferRecord = require("../transfer/fetchDirectBridgeCryptoToFiatTransferRecord")


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
   },
   EXTERNAL:{
    BRIDGE: fetchDirectBridgeCryptoToFiatTransferRecord
   }
}

module.exports = {
    FetchCryptoToBankSupportedPairCheck,
}