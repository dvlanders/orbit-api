const getBridgeConversionRate = require("../main/getBridgeCoversionRate")

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
        eur: getBridgeConversionRate
    }
}

module.exports = getCryptoToFiatConversionRateFunction