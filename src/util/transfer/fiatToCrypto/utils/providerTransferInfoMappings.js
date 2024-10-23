
const FiatProviderSelectMap = {
    CHECKBOOK: "checkbook_transfer_info:checkbook_transaction_record_id(*)"
}

const CryptoProviderSelectMap = {
    BRIDGE: "bridge_transfer_info:bridge_transaction_record_id(*)"
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

