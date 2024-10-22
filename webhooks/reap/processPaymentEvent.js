const createLog = require("../../src/util/logger/supabaseLogger")
const { updateReapTransactionRecord } = require("../../src/util/reap/utils/reapTransactionTableService")
const supabase = require("../../src/util/supabaseClient")
const { getOfframpTransactionRecord, updateOfframpTransactionRecord } = require("../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService")
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction")
const { updateRequestRecord } = require("../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord")
const notifyCryptoToFiatTransfer = require("../transfer/notifyCryptoToFiatTransfer")

const processPaymentEvent = async(event) => {
    try{
        const paymentId = event.paymentId
        const offrampRecordId = event.paymentInfo.metadata.offrampRecordId
        const offrampRecord = await getOfframpTransactionRecord(offrampRecordId)
        const reapTransactionRecordId = offrampRecord.reap_transaction_record_id
        if (!offrampRecordId) throw new Error(`No offramp record id found for reap payment id: ${paymentId}`)

        let toUpdateReapTransactionRecord = {
            reap_response: event,
            reap_payment_status: event.status,
            updated_at: new Date().toISOString()
        }
        let toUpdateOfframpTransactionRecord = {
            updated_at: new Date().toISOString()
        }
        if (event.status == "awaiting_funds"){
            // NOT PROCESS FOR NOW
            return
        }else if (event.status == "under_review"){
            toUpdateOfframpTransactionRecord.transaction_status = "IN_PROGRESS_FIAT"

            if (process.env.NODE_ENV == "development") {
                toUpdateOfframpTransactionRecord.transaction_status = "COMPLETED"
                toUpdateOfframpTransactionRecord.failed_reason = "This is a simulated success response for sandbox environment only."
            }

        }else if (event.status == "requires_action"){
            toUpdateReapTransactionRecord.transaction_status = "ACTION_REQUIRED"
        }else if (event.status == "payout_completed"){
            toUpdateOfframpTransactionRecord.transaction_status = "COMPLETED"
        }else if (event.status == "canceled"){
            toUpdateOfframpTransactionRecord.transaction_status = "CANCELLED"
        }else if (event.status == "failed"){
            toUpdateOfframpTransactionRecord.transaction_status = "FAILED_UNKNOWN"
            toUpdateOfframpTransactionRecord.failed_reason = "Please reach out to HIFI for more information"
        }else if (event.status == "awaiting_approval"){
            // NOT PROCESS FOR NOW
            return
        }

        // update
        const [updatedReapTransactionRecord, updatedOfframpTransactionRecord] = await Promise.all([
            updateReapTransactionRecord(reapTransactionRecordId, toUpdateReapTransactionRecord),
            updateOfframpTransactionRecord(offrampRecordId, toUpdateOfframpTransactionRecord)
        ])

        // send out webhook message if in sandbox
        if (process.env.NODE_ENV == "development") {
            await simulateSandboxCryptoToFiatTransactionStatus(updatedOfframpTransactionRecord, ["COMPLETED_ONCHAIN", "IN_PROGRESS_FIAT", "INITIATED_FIAT"])
        }
        
        
        await notifyCryptoToFiatTransfer(data)
        
    }catch (error){
        await createLog("webhooks/reap/processPaymentEvent", null, error.message, error)
        throw error
    }
}

module.exports = processPaymentEvent