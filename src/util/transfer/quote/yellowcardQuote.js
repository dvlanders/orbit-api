const createYellowcardRequestForQuote = require("../../yellowcard/createYellowcardRequestForQuote");
const { updateYellowCardTransactionInfo } = require("../../yellowcard/transactionInfoService");
const { updateOfframpTransactionRecord } = require("../cryptoToBankAccount/utils/offrampTransactionsTableService");

const getQuoteFromYellowcard = async (offrampTransactionRecord) => {
    const offrampTransactionRecordId = offrampTransactionRecord.id
    try{
        const destinationUserId = offrampTransactionRecord.destination_user_id
        const destinationAccountId = offrampTransactionRecord.destination_account_id
        const amount = offrampTransactionRecord.amount
        const destinationCurrency = offrampTransactionRecord.destination_currency
        const sourceCurrency = offrampTransactionRecord.source_currency
        const description = offrampTransactionRecord.description
        const purposeOfPayment = offrampTransactionRecord.purpose_of_payment
        const yellowcardTransactionRecordId = offrampTransactionRecord.yellowcard_transaction_record_id

        const { yellowcardRequestForQuote, foundOfferings } = await createYellowcardRequestForQuote(destinationUserId, destinationAccountId, amount, destinationCurrency, sourceCurrency, description, purposeOfPayment)
	
        const toUpdateYC = {
            updated_at: new Date().toISOString(),
            yellowcard_rfq_response: yellowcardRequestForQuote,
        }
        const toUpdateOfframp = {
            updated_at: new Date().toISOString(),
        }

        // no offering found
        if (!foundOfferings) {
            toUpdateOfframp.transaction_status = "QUOTE_FAILED"
            toUpdateOfframp.failed_reason = "No offerings found for the selected payment pair"
        }else if (yellowcardRequestForQuote) {
            // update yellowcard transaction info
            toUpdateYC.yellowcard_rfq_response = yellowcardRequestForQuote
            toUpdateYC.payout_units_per_payin_unit = yellowcardRequestForQuote.data.payoutUnitsPerPayinUnit
            toUpdateYC.quote_id = yellowcardRequestForQuote.metadata.id
            toUpdateYC.quote_expires_at = new Date(yellowcardRequestForQuote.data.expiresAt).toISOString()
            toUpdateYC.exchange_id = yellowcardRequestForQuote.metadata.exchangeId


            const conversionRate = {
                fromCurrency: offrampTransactionRecord.source_currency,
                toCurrency: offrampTransactionRecord.destination_currency,
                conversionRate: yellowcardRequestForQuote.data.payoutUnitsPerPayinUnit,
                vaildFrom: new Date().toISOString(),
                vaildUntil: yellowcardRequestForQuote.data.expiresAt ? new Date(yellowcardRequestForQuote.data.expiresAt).toISOString() : new Date().toISOString(),
            }

            toUpdateOfframp.conversion_rate = conversionRate
            toUpdateOfframp.transaction_status = "OPEN_QUOTE"
        }else{
            toUpdateOfframp.transaction_status = "QUOTE_FAILED"
            toUpdateOfframp.failed_reason = "Unable to get quote, please try again later"
        }

        await Promise.all([
            updateOfframpTransactionRecord(offrampTransactionRecordId, toUpdateOfframp),
            updateYellowCardTransactionInfo(yellowcardTransactionRecordId, toUpdateYC)
        ])

    }catch(error){
        await createLog("yellowcard/main/getQuoteFromYellowcard", null, error.message, error)
        throw new Error("Failed to get quote from yellowcard")
    }

}

module.exports = {
    getQuoteFromYellowcard
}