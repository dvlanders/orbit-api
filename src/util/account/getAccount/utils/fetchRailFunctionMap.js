const {fetchBridgeExternalAccountInformation} = require("../main/fetchBridgeExternalAccountInformation")
const fetchBridgeVirtualAccount = require("../main/fetchBridgeVirtualAccount")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")

const fetchRailFunctionsMap = {
	usOffRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("usd", profileId, accountId, userId, limit, createdAfter, createdBefore),
	euOffRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("eur", profileId, accountId, userId, limit, createdAfter, createdBefore),
	usOnRamp: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchPlaidAccountInformation(profileId, accountId, userId, limit, createdAfter, createdBefore)
}

const getFetchOnRampVirtualAccountFunctions = (rail, destinationCurrency, destinationChain) => {
	try{
        return fetchOnRampVirtualAccountFunctionsMap[rail][destinationChain][destinationCurrency]
    }catch (error){
        return null
    }
}

const fetchOnRampVirtualAccountFunctionsMap = {
	US_ACH_WIRE: {
		POLYGON_MAINNET: { 
			usdc: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdc", "POLYGON_MAINNET", limit, createdBefore, createdAfter),
		},
		ETHEREUM_MAINNET: {
			usdc: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdc", "ETHEREUM_MAINNET", limit, createdBefore, createdAfter),
			usdt: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdt", "ETHEREUM_MAINNET", limit, createdBefore, createdAfter),
		},
		OPTIMISM_MAINNET: {
			usdc: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdc", "OPTIMISM_MAINNET", limit, createdBefore, createdAfter),
		},
		BASE_MAINNET: {
			usdc: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdc", "BASE_MAINNET", limit, createdBefore, createdAfter),
		}
	}
}

module.exports = {
	fetchRailFunctionsMap,
	getFetchOnRampVirtualAccountFunctions
}