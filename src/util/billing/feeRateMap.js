
const defaultFeeForUnknownTag = {
    type: "FIX",
    value: 0
}

const _getTagFeeRate = (tag, feeConfig) => {
    try{
        if (!feeConfig) return defaultFeeForUnknownTag
        const feeRate = feeConfig[tag]
        return feeRate || defaultFeeForUnknownTag
    }catch (error){
        return defaultFeeForUnknownTag
    }
}

const getFee = (transaction, feeConfig, success=true) => {

    // get provider
    const fiatProvider = transaction.fiat_provider || "DEFAULT"
    const cryptoProvider = transaction.crypto_provider || "DEFAULT"
    // get fee config for provider
    const feeConfigForFiatProvider = feeConfig[fiatProvider] || feeConfig["DEFAULT"]
    const feeConfigForCryptoProvider = feeConfig[cryptoProvider] || feeConfig["DEFAULT"]

    // get currency
    const currency = transaction.currency || "DEFAULT"
    // get fee config for currency
    const fiatFeeConfigForCurrency = feeConfigForFiatProvider[currency] || feeConfigForFiatProvider["DEFAULT"]
    const cryptoFeeConfigForCurrency = feeConfigForCryptoProvider[currency] || feeConfigForCryptoProvider["DEFAULT"]

    // get tags
    const tags = (success ? transaction.billing_tags_success : transaction.billing_tags_failed) || []

    let fee = 0
    tags.map((tag) => {

        const fiatFeeRate = _getTagFeeRate(tag, fiatFeeConfigForCurrency)
        const cryptoFeeRate = _getTagFeeRate(tag, cryptoFeeConfigForCurrency)

        if (fiatFeeRate.type == "PERCENT"){
            fee += parseFloat(fiatFeeRate.value) * transaction.amount
        }else if (fiatFeeRate.type == "FIX"){
            fee += parseFloat(fiatFeeRate.value)
        }
        // crypto
        if (cryptoFeeRate.type == "PERCENT"){
            fee += parseFloat(cryptoFeeRate.value) * transaction.amount
        }else if (cryptoFeeRate.type == "FIX"){
            fee += parseFloat(cryptoFeeRate.value)
        }

    })
    return fee

}

const getFeeCrypto = (transaction, feeConfig, success=true) => {
    // get provider
    const provider = transaction.provider || "DEFAULT"
    // get fee config for provider
    const feeConfigForProvider = feeConfig[provider] || feeConfig["DEFAULT"]

    // get currency
    const chain = transaction.chain || "DEFAULT"
    // get fee config for currency
    const feeConfigForChain = feeConfigForProvider[chain] || feeConfigForProvider["DEFAULT"]

    // get tags
    const tags = (success ? transaction.billing_tags_success : transaction.billing_tags_failed) || []

    let fee = 0
    tags.map((tag) => {
        const feeRate = _getTagFeeRate(tag, feeConfigForChain)
        
        if (feeRate.type == "PERCENT"){
            fee += parseFloat(feeRate.value) * transaction.amount
        }else if (feeRate.type == "FIX"){
            fee += parseFloat(feeRate.value)
        }

    })
    return fee
}


module.exports = {
    getFee,
    getFeeCrypto
}