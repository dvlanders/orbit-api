const createLog = require("../../../logger/supabaseLogger")

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const getBridgeConversionRate = async(fromCurrency, toCurrency, profileId) => {
    try{
        let vaildFrom = new Date();
        let vaildUntil = new Date(vaildFrom);
        vaildUntil.setSeconds(vaildUntil.getSeconds() + 30);
        
        if (toCurrency == "usd") {
            return {
                fromCurrency,
                toCurrency,
                conversionRate: 1,
                vaildFrom,
                vaildUntil
            }
        }

        // FIXME 
        const from = "usd"
        const to = toCurrency

        const response = await fetch(`${BRIDGE_URL}/v0/exchange_rates?from=${from}&to=${to}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});
		const responseBody = await response.json();
        if (!response.ok) {
            await createLog("transfer/conversionRate/getBridgeConversionRate", null, responseBody.message, responseBody, profileId) 
            return {
                fromCurrency,
                toCurrency,
                conversionRate: null,
                vaildFrom,
                vaildUntil,
                message: "Not available"
            }
        }

        return {
            fromCurrency,
            toCurrency,
            conversionRate: responseBody.midmarket_rate,
            vaildFrom,
            vaildUntil
        }

    }catch (error){
        await createLog("transfer/conversionRate/getBridgeConversionRate", null, error.message, error, profileId)
        return {
            fromCurrency,
            toCurrency,
            conversionRate: null,
            vaildFrom,
            vaildUntil,
            message: "Not available"
        }
    }

}

module.exports = getBridgeConversionRate