const transferFromPlaidToBankAccount = require("../transfer/transferFromPlaidToBankAccount")

const FiatToFiatSupportedPairFunctionsCheck = (sourceCurrency, destinationCurrency) => {
    try{
        return FiatToFiatSupportedPairFunctions[sourceCurrency][destinationCurrency]
    }catch (error){
        return null
    }
}

const FiatToFiatSupportedPairFunctions = {
    usd:{
        usd: transferFromPlaidToBankAccount
    }
}

module.exports = FiatToFiatSupportedPairFunctionsCheck