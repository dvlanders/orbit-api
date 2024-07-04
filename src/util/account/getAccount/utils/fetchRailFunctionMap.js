const {fetchBridgeExternalAccountInformation} = require("../main/fetchBridgeExternalAccountInformation")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")

const fetchRailFunctionsMap = {
	usOffRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("usd", profileId, accountId, userId, limit, createdAfter, createdBefore),
	euOffRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("eur", profileId, accountId, userId, limit, createdAfter, createdBefore),
	usOnRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchPlaidAccountInformation(profileId, accountId, userId, limit, createdAfter, createdBefore)
}

module.exports = fetchRailFunctionsMap