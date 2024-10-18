const createLog = require("../../../logger/supabaseLogger");
const { fetchSelectedOffering } = require("../../../yellowcard/utils/fetchSelectedOffering");

const getYellowcardConversionRate = async(fromCurrency, toCurrency, profileId) => {
    try {
        let validFrom = new Date();
        let validUntil = new Date(validFrom);
        validUntil.setSeconds(validUntil.getSeconds() + 30);
        
        if (toCurrency == "usd") {
            return {
                fromCurrency,
                toCurrency,
                conversionRate: 1,
                validFrom,
                validUntil
            }
        }

        // get offering through TBDEX
        const { foundOfferings, selectedOffering } = await fetchSelectedOffering(fromCurrency, toCurrency);
        if (!foundOfferings) {
            await createLog("transfer/conversionRate/getYellowcardConversionRate", null, `${fromCurrency}-${toCurrency} pair is not exsting in offerings`, null, profileId)
            return {
                fromCurrency,
                toCurrency,
                conversionRate: null,
                validFrom,
                validUntil,
                message: `Not available`
            }
        }
        
        return {
            fromCurrency,
            toCurrency,
            conversionRate: selectedOffering.data.payoutUnitsPerPayinUnit,
            validFrom,
            validUntil
        }

    } catch (error){
        await createLog("transfer/conversionRate/getYellowcardConversionRate", null, error.message, error, profileId)
        return {
            fromCurrency,
            toCurrency,
            conversionRate: null,
            validFrom,
            validUntil,
            message: "Not available"
        }
    }
}

module.exports = getYellowcardConversionRate;