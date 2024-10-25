const { getOfframpTransactionRecord } = require("../../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService")
const { quoteFunctionMap } = require("../../../src/util/transfer/quote/quoteFunctionMap")
const notifyCryptoToFiatTransfer = require("../../../webhooks/transfer/notifyCryptoToFiatTransfer")

const getQuote = async (config) => {
    const {offrampTransactionRecordId, profileId, userId} = config
    try{
        const offrampTransactionRecord = await getOfframpTransactionRecord(offrampTransactionRecordId)

        const quoteFunction = quoteFunctionMap[offrampTransactionRecord.fiat_provider]?.getQuote
        if(!quoteFunction){
            throw new Error("No quote function found for the fiat provider")
        }

        await quoteFunction(offrampTransactionRecord)
        await notifyCryptoToFiatTransfer(offrampTransactionRecord)

    }catch(error){
        await createLog("asyncJobs/transfer/quote/getQuote", null, error.message, error)
        throw new Error("Failed to get quote")
    }
}

module.exports = {
    getQuote
}