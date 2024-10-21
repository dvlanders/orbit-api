const getBridgeConversionRate = require("../main/getBridgeCoversionRate")
const getBlindpayConversionRate = require("../main/getBlindpayConversionRate")
const getYellowcardConversionRate = require("../main/getYellowcardConversionRate")

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
        ugx: getYellowcardConversionRate,
        ngn: getYellowcardConversionRate,
        kes: getYellowcardConversionRate,
        xof: getYellowcardConversionRate,
        rwf: getYellowcardConversionRate,
        tzs: getYellowcardConversionRate,
        zmw: getYellowcardConversionRate,
        mwk: getYellowcardConversionRate,
        xaf: getYellowcardConversionRate,
    }
}

module.exports = getCryptoToFiatConversionRateFunction