const _getFeeRate = (provider, currency, feeConfig) => {
    try{
        const feeRate = feeConfig[provider][currency]
        return feeRate || feeConfig[provider]["DEFAULT"] || feeConfig["DEFAULT"]
    }catch (error){
        return feeConfig["DEFAULT"]
    }
}

const getFee = (transaction, feeConfig) => {

    const feeRateFiat = _getFeeRate(transaction.fiat_provider, transaction.currency, feeConfig)
    const feeRateCrypto = _getFeeRate(transaction.crypto_provider, transaction.currency, feeConfig)
  
    let fee = 0
    // fiat
    if (feeRateFiat.type == "PERCENT"){
        fee += parseFloat(feeRateFiat.value) * transaction.amount
    }else if (feeRateFiat.type == "FIX"){
        fee += parseFloat(feeRateFiat.value)
    }
    // crypto
    if (feeRateCrypto.type == "PERCENT"){
        fee += parseFloat(feeRateCrypto.value) * transaction.amount
    }else if (feeRateCrypto.type == "FIX"){
        fee += parseFloat(feeRateCrypto.value)
    }

    return fee;

}


const feeMap = (transactions, feeConfig) => {
    let totalFee = 0
    const feeInformation = {}

    transactions.map((trx) => {
        const feeRateFiat = _getFeeRate(trx.fiat_provider, trx.currency, feeConfig)
        const feeRateCrypto = _getFeeRate(trx.crypto_provider, trx.currency, feeConfig)
        // FIX ME consider transform to usd
        let fee = 0
        // fiat
        if (feeRateFiat.type == "PERCENT"){
            fee += parseFloat(feeRateFiat.value) * trx.total_amount
        }else if (feeRateFiat.type == "FIX"){
            fee += parseFloat(feeRateFiat.value) * trx.count
        }
        // crypto
        if (feeRateCrypto.type == "PERCENT"){
            fee += parseFloat(feeRateCrypto.value) * trx.total_amount
        }else if (feeRateCrypto.type == "FIX"){
            fee += parseFloat(feeRateCrypto.value) * trx.count
        }
        totalFee += fee
    })

    return totalFee
}

module.exports = {
    feeMap,
    getFee
}