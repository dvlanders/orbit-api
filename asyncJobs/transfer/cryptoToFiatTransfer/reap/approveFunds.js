const { getBastionTransactionRecord } = require("../../../../src/util/bastion/main/bastionTransactionTableService")
const createLog = require("../../../../src/util/logger/supabaseLogger")
const { approveFundsRelease } = require("../../../../src/util/reap/main/approveFundsRelease")
const { getReapTransactionRecord } = require("../../../../src/util/reap/utils/reapTransactionTableService")
const { getOfframpTransactionRecord } = require("../../../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService")
const { getWalletTransactionRecord, getWalletColumnNameFromProvider } = require("../../../../src/util/transfer/walletOperations/utils")

const reapApproveFundsAsync = async(config) => {
    const {offrampRecordId, userId} = config
    try{
        const offrampRecord = await getOfframpTransactionRecord(offrampRecordId)
        // check if wallet transaction is successful
        if (offrampRecord.transaction_status !== "COMPLETED_ONCHAIN"){
            return { retryDetails: { retry: true, delay: 30000, reason: "Crypto transfer not yet confirmed" } }
        }
        // approve transaction
        const reapTransactionId = offrampRecord.reap_transaction_record_id
        await approveFundsRelease(reapTransactionId, offrampRecordId)
    }catch(error){
        await createLog("asyncJobs/transfer/cryptoToFiatTransfer/reap/approveFunds", userId, error.message, error)
        return { retryDetails: { retry: true, delay: 60000, reason: "Reap approve funds failed" } }
    }
}

module.exports = {
    reapApproveFundsAsync
}