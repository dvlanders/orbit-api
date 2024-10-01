
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
        console.error(`Error getting fee rate for tag ${tag}: ${error}`)
        return defaultFeeForUnknownTag
    }
}

const getFee = (transaction, feeConfig, success=true) => {

    // get provider
    const fiatProvider = transaction.fiat_provider || "DEFAULT"
    const cryptoProvider = transaction.crypto_provider || "DEFAULT"

    // get currency
    const currency = transaction.currency || "DEFAULT"

    // get tags
    const tags = (success ? transaction.billing_tags_success : transaction.billing_tags_failed) || []

    let fee =0
    tags.map((tag) => {
        const fiatFeeConfigForCurrency = feeConfig[fiatProvider][currency]
        const cryptoFeeConfigForCurrency = feeConfig[cryptoProvider][currency]

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
    return fee;

}


const feeMap = (transactions, feeConfig) => {
    let totalFee = 0
    const feeInformation = {}

    transactions.map((trx) => {
        const fee = getFee(trx, feeConfig)
        totalFee += fee
    })

    return totalFee
}

module.exports = {
    feeMap,
    getFee
}