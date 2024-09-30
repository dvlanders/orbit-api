const getBridgeConversionRate = require("../main/getBridgeCoversionRate")
const getBlindpayConversionRate = require("../main/getBlindpayConversionRate")

const getCryptoToFiatConversionRateFunction = (fromCurrency, toCurrency) => {
    try{
        return cryptoTOFiatConversionRateProviderMap[fromCurrency][toCurrency]
    }catch(error){
        return null
    }
}

const cryptoTOFiatConversionRateProviderMap = {
    usdc: {
        usd: getBridgeConversionRate,
        eur: getBridgeConversionRate,
        brl: getBlindpayConversionRate,
        mxn: getBlindpayConversionRate,
        cop: getBlindpayConversionRate,
        ars: getBlindpayConversionRate,
    }
}

module.exports = getCryptoToFiatConversionRateFunction