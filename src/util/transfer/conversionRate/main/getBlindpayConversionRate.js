const createLog = require("../../../logger/supabaseLogger")
const { checkQuote } = require("../../../blindpay/endpoint/checkQuote");
const { CreateQuoteError } = require("../../../blindpay/errors");

const getBlindpayConversionRate = async(fromCurrency, toCurrency, profileId) => {
    try{
        let vaildFrom = new Date();
        let vaildUntil = new Date(vaildFrom);
        vaildUntil.setSeconds(vaildUntil.getSeconds() + 60);
        
        if (toCurrency == "usd") {
            return {
                fromCurrency,
                toCurrency,
                conversionRate: 1,
                vaildFrom,
                vaildUntil
            }
        }

        const responseBody = await checkQuote("USD", toCurrency.toUpperCase());
        vaildFrom = new Date();
        vaildUntil = new Date(vaildFrom);
        vaildUntil.setSeconds(vaildUntil.getSeconds() + 60);
        return {
            fromCurrency,
            toCurrency,
            conversionRate: responseBody.blindpay_quotation / 100.0,
            vaildFrom,
            vaildUntil
        }

    }catch (error){
        const errorResponse = error instanceof CreateQuoteError ? error.rawResponse : error;
        await createLog("transfer/conversionRate/getBlindpayConversionRate", null, error.message, errorResponse, profileId);
        return {
            fromCurrency,
            toCurrency,
            conversionRate: null,
            vaildFrom: null,
            vaildUntil: null,
            message: "Not available"
        }
    }

}

module.exports = getBlindpayConversionRate