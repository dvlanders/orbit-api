const {fetchBridgeExternalAccountInformation} = require("../main/fetchBridgeExternalAccountInformation")
const fetchBridgeVirtualAccount = require("../main/fetchBridgeVirtualAccount")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")
const fetchCircleAccount = require("../main/fetchCircleAccount")
const fetchBlindpayAccount = require("../main/fetchBlindpayAccount")

const fetchRailFunctionsMap = {
	USD_ONRAMP_ACH: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchPlaidAccountInformation(profileId, accountId, userId, limit, createdAfter, createdBefore),
	USD_OFFRAMP_ACH: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("usd", profileId, accountId, userId, limit, createdAfter, createdBefore),
	USD_OFFRAMP_WIRE: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchCircleAccount("us", profileId, accountId, userId, limit, createdAfter, createdBefore),
	EUR_OFFRAMP_SEPA: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBridgeExternalAccountInformation("eur", profileId, accountId, userId, limit, createdAfter, createdBefore),
	BRL_OFFRAMP_PIX: async (accountId, profileId, userId, limit, createdAfter, createdBefore) => await fetchBlindpayAccount("BRL", profileId, accountId, userId, limit, createdAfter, createdBefore)
}

/**
 * Generates a composite key for the rail.
 * Only allow these rail key combinations: currency, railType, currency_railType, railType_paymentRail, currency_railType_paymentRail
 * @param {string} currency - currency of the rail. Eg. usd, eur, brl
 * @param {string} railType - type of the rail. Eg. onramp, offramp
 * @param {string} paymentRail - payment rail. Eg. ach, wire, sepa, pix
 * @returns {string} - composite key. Eg. USD_ONRAMP_ACH
 */
const generateRailCompositeKey = (currency, railType, paymentRail) => {
	if(currency && !railType) return currency.toUpperCase();
	if(!currency && railType && !paymentRail) return railType.toUpperCase();
	if(currency && railType && !paymentRail) return `${currency}_${railType}`.toUpperCase();
	if(!currency && railType && paymentRail) return `${railType}_${paymentRail}`.toUpperCase();
	if(currency && railType && paymentRail) return `${currency}_${railType}_${paymentRail}`.toUpperCase();
	return ""
}

/**
 * Validates if the key is a valid composite key for the rail.
 * @param {string} key - composite key
 * @returns {boolean} - true if valid, false otherwise
 */
const validateRailCompositeKey = (key) => {
    const regex = new RegExp(key, 'i');
    return Object.keys(fetchRailFunctionsMap).some(mapKey => regex.test(mapKey));
}

const accountInfoAggregator = (funcs) => (async (accountId, profileId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
        const results = await Promise.all(Object.keys(funcs).map(async (key) => {
            const func = funcs[key];
            let accountInfo = await func(accountId, profileId, userId, limit, createdAfter, createdBefore);
			
			if(!accountInfo)return { count: 0, banks: [] };
			if(!accountInfo.hasOwnProperty('count')) accountInfo = { count: 1, banks: [accountInfo] };
    
            const banksWithRail = accountInfo.banks.map(bank => ({
                ...bank,
                rail: key.toLowerCase()
            }));
            return {
                count: accountInfo.count,
                banks: banksWithRail
            };
            
        }));

		const allBanks = results.reduce((acc, curr) => {
			acc.push(...curr.banks);
			return acc;
		}, []);

		// TODO: can get top 'limit' banks in O(limit) with min-heap, but this works for now
		allBanks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		const topBanks = allBanks.slice(0, limit);

        return {
			count: topBanks.length,
			banks: topBanks
		};
    
	})

/**
 * Returns an aggregator function that aggregates the account info results from multiple rail function calls
 * @param {string} railKey - key to match the rail functions. Will do a substring match.
 * @returns {function} - aggregator function
 */
const getFetchRailFunctions = (railKey) => {
	const regex = new RegExp(railKey, 'i');
    const funcs = Object.keys(fetchRailFunctionsMap)
        .filter(key => regex.test(key))
        .reduce((acc, key) => {
            acc[key] = fetchRailFunctionsMap[key];
            return acc;
        }, {});
	return accountInfoAggregator(funcs);
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
		POLYGON_AMOY: {
			usdc: async(userId, limit, createdBefore, createdAfter) => await fetchBridgeVirtualAccount(userId, "usd", "usdc", "POLYGON_AMOY", limit, createdBefore, createdAfter),
		},
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
	getFetchOnRampVirtualAccountFunctions,
	getFetchRailFunctions,
	generateRailCompositeKey,
	validateRailCompositeKey
}