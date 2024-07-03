const {fetchBridgeExternalAccountInformation} = require("../main/fetchBridgeExternalAccountInformation")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")

const fetchRailFunctionsMap = {
	usOffRamp: async (accountId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("usd", accountId, limit, createdAfter, createdBefore),
	euOffRamp: async (accountId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("eur", accountId, limit, createdAfter, createdBefore),
	usOnRamp: async (accountId, limit, createdAfter, createdBefore) => await fetchPlaidAccountInformation(accountId, limit, createdAfter, createdBefore)
}

module.exports = fetchRailFunctionsMap