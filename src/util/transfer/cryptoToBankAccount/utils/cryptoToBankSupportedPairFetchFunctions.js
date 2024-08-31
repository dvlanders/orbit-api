const { now } = require("moment")
const { transferType } = require("../../utils/transfer")
const fetchBridgeCryptoToFiatTransferRecord = require("../transfer/fetchBridgeCryptoToFiatTransferRecordV2")
const fetchDirectBridgeCryptoToFiatTransferRecord = require("../transfer/fetchDirectBridgeCryptoToFiatTransferRecord")
const fetchReapCryptoToFiatTransferRecord = require("../transfer/fetchReapCryptoToFiatTransferRecord")

const placeholder = (recordId, profileId) => {
    return {
        transferType: transferType.CRYPTO_TO_FIAT,
        transferDetails: {
            id: recordId,
            requestId: "placeholder",
            sourceUserId: "placeholder",
            destinationUserId: "placeholder",
            chain: "placeholder",
            sourceCurrency: "placeholder",
            amount: "placeholder",
            destinationCurrency: "placeholder",
            liquidationAddress: "placeholder",
            destinationAccountId: "placeholder",
            transactionHash: "placeholder",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "CREATED",
            contractAddress: "placeholder",
            sourceUser: {

            },
            destinationUser: {

            },
            destinationAccount: {

            },
            failedReason: "",
            fee: null,
        }

    }
}

const FetchCryptoToBankSupportedPairCheck = (cryptoProvider, fiatProvider) => {
    try {
        return FetchCryptoToBankSupportedPairFunctions[cryptoProvider][fiatProvider] || FetchCryptoToBankSupportedPairFunctions.DEFAULT
    }catch (error){
        return FetchCryptoToBankSupportedPairFunctions.DEFAULT
    }
}

const FetchCryptoToBankSupportedPairFunctions = {
   BASTION:{
    BRIDGE: fetchBridgeCryptoToFiatTransferRecord
   },
   EXTERNAL:{
    BRIDGE: fetchDirectBridgeCryptoToFiatTransferRecord
   },
   BASTION: {
    REAP: fetchReapCryptoToFiatTransferRecord
   },
   DEFAULT: placeholder
}

module.exports = {
    FetchCryptoToBankSupportedPairCheck,
}