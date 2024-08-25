const { safeStringToFloat } = require("../../../utils/number")

const cryptoToFiatAmountCheck = (amount, currency, chain) => {
    const numericAmount = parseFloat(amount)
    if (currency == "usdt"){
        return numericAmount >= 21
    }else{
        return numericAmount >= 1
    }
}

module.exports = {
    cryptoToFiatAmountCheck
}