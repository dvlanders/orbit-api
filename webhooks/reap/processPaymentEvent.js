const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction")
const { updateRequestRecord } = require("../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord")
const notifyCryptoToFiatTransfer = require("../transfer/notifyCryptoToFiatTransfer")

const processPaymentEvent = async(event) => {
    try{
        const paymentId = event.paymentId
        let toUpdate = {
            reap_payment_response: event,
            reap_payment_status: event.status,
            updated_at: new Date().toISOString()
        }
        if (event.status == "awaiting_funds"){
            // NOT PROCESS FOR NOW
            return
        }else if (event.status == "under_review"){
            toUpdate.transaction_status = "IN_PROGRESS_FIAT"

            if (process.env.NODE_ENV == "development") {
                toUpdate.transaction_status = "COMPLETED"
                toUpdate.failed_reason = "This is a simulated success response for sandbox environment only."
            }

        }else if (event.status == "requires_action"){
            toUpdate.transaction_status = "ACTION_REQUIRED"
        }else if (event.status == "payout_completed"){
            toUpdate.transaction_status = "COMPLETED"
        }else if (event.status == "canceled"){
            toUpdate.transaction_status = "CANCELLED"
        }else if (event.status == "failed"){
            toUpdate.transaction_status = "FAILED_UNKNOWN"
            toUpdate.failed_reason = "Please reach out to HIFI for more information"
        }

        // update
        const {data, error} = await supabase
            .from("offramp_transactions")
            .update(toUpdate)
            .eq("fiat_provider", "REAP")
            .eq("reap_payment_id", paymentId)
            .select("*")
            .maybeSingle()
        
        if (error) throw error
        if (!data) throw new Error(`No reap payment record found for reap payment id: ${paymentId}`)

        // send out webhook message if in sandbox
        if (process.env.NODE_ENV == "development") {
            await simulateSandboxCryptoToFiatTransactionStatus(data, ["COMPLETED_ONCHAIN", "IN_PROGRESS_FIAT", "INITIATED_FIAT"])
        }
        
        
        await notifyCryptoToFiatTransfer(data)
        

    }catch (error){
        await createLog("webhooks/reap/processPaymentEvent", null, error.message, error)
        throw error
    }
}

module.exports = processPaymentEvent