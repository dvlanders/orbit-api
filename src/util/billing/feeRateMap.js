const _getFeeRate = (provider, currency, feeConfig) => {
    try{
        const feeRate = feeConfig[provider][currency]
        return feeRate || feeConfig[provider]["DEFAULT"] || feeConfig["DEFAULT"]
    }catch (error){
        return feeConfig["DEFAULT"]
    }
}


exports.feeMap = (transactions, feeConfig) => {
    let totalFee = 0
    const feeInformation = {}

    transactions.map((trx) => {
        const feeRateFiat = _getFeeRate(trx.fiat_provider, trx.currency, feeConfig)
        const feeRateCrypto = _getFeeRate(trx.crypto_provider, trx.currency, feeConfig)
        // FIX ME consider transform to usd
        const fee = parseFloat(feeRateFiat) * trx.total_amount + parseFloat(feeRateCrypto) * trx.total_amount
        totalFee += fee
    })

    return totalFee
}