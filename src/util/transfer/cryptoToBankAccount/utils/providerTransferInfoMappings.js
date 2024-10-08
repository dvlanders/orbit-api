
const FiatProviderSelectMap = {
    BLINDPAY: "blindpay_transfer_info:blindpay_transaction_id(*)",
    BRIDGE: "", //TODO: Add the select clause mapping
    REAP: "", //TODO: Add the select clause mapping
}

const CryptoProviderSelectMap = {
    BASTION: "", //TODO: Add the select clause mapping
}

const getFiatProviderSelectClause = (provider) => {
    return FiatProviderSelectMap[provider] || "";
}

const getCryptoProviderSelectClause = (provider) => {
    return CryptoProviderSelectMap[provider] || "";
}


module.exports = {
    getFiatProviderSelectClause,
    getCryptoProviderSelectClause
}

