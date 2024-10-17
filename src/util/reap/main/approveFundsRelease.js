const notifyCryptoToFiatTransfer = require("../../../../webhooks/transfer/notifyCryptoToFiatTransfer")
const createLog = require("../../logger/supabaseLogger")
const { updateOfframpTransactionRecord } = require("../../transfer/cryptoToBankAccount/utils/offrampTransactionsTableService")
const { safeParseBody } = require("../../utils/response")
const { getReapTransactionRecord, updateReapTransactionRecord } = require("../utils/reapTransactionTableService")
const approvePayment = require("./approvePayment")
const getReapPayment = require("./getPayment")

const approveFundsRelease = async(reapTransactionId, offrampTransactionId) => {
    let userId = null
    try{
        const reapTransactionRecord = await getReapTransactionRecord(reapTransactionId)
        if (reapTransactionRecord.reap_payment_status !== "awaiting_approval"){
            throw new Error(`Reap transaction record: ${reapTransactionId} is not awaiting approval`)
        }
        const paymentId = reapTransactionRecord.reap_payment_id
        userId = reapTransactionRecord.user_id
        // approve payment
        const response = await approvePayment(paymentId, userId)
        const responseBody = await safeParseBody(response)

        if (!response.ok){
            await createLog("reap/approveFunds", userId, responseBody.message, responseBody)
            throw new Error("Reap approve payment failed")
        }

        // update reap transaction status
        // get latest payment
        const updatedPaymentresponse = await getReapPayment(paymentId, userId)
        const updatedPaymentresponseBody = await safeParseBody(updatedPaymentresponse)

        const toUpdateReapTransactionRecord = {
            reap_response: updatedPaymentresponse,
            updated_at: new Date().toISOString()
        }

        const toUpdateOfframpTransactionRecord = {
            updated_at: new Date().toISOString()
        }

        // get status failed
        if (!updatedPaymentresponse.ok){
            await createLog("reap/approveFunds", userId, updatedPaymentresponseBody.message, updatedPaymentresponseBody)
            toUpdateOfframpTransactionRecord.failed_reason = "Please contact HIFI for more information"
            toUpdateOfframpTransactionRecord.transaction_status = "FAILED"
        }else{
            toUpdateOfframpTransactionRecord.transaction_status = "IN_PROGRESS_FIAT"
            toUpdateReapTransactionRecord.reap_payment_status = updatedPaymentresponseBody.status
        }

        const [updatedReapTransactionRecord, updatedOfframpTransactionRecord] = await Promise.all([
            updateReapTransactionRecord(reapTransactionId, toUpdateReapTransactionRecord),
            updateOfframpTransactionRecord(offrampTransactionId, toUpdateOfframpTransactionRecord)
        ])

        await notifyCryptoToFiatTransfer(updatedOfframpTransactionRecord)

    }catch(error){
        await createLog("reap/approveFunds", userId, error.message, error)
        throw new Error("Reap approve funds release failed")
    }
}

module.exports = {
    approveFundsRelease
}