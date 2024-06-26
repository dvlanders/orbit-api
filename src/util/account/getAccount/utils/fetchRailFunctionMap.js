const fetchBridgeExternalAccountInformation = require("../main/fetchBridgeExternalAccountInformation")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")

const fetchRailFunctionsMap = {
    usOffRamp: async(accountId) => await fetchBridgeExternalAccountInformation("usd", accountId),
    euOffRamp: async(accountId) => await fetchBridgeExternalAccountInformation("eur", accountId),
    usOnRamp: async(accountId) => await fetchPlaidAccountInformation(accountId)
}

module.exports = fetchRailFunctionsMap