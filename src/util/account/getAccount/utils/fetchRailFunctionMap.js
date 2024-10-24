const {fetchBridgeExternalAccountInformation} = require("../main/fetchBridgeExternalAccountInformation")
const fetchBridgeVirtualAccount = require("../main/fetchBridgeVirtualAccount")
const fetchPlaidAccountInformation = require("../main/fetchPlaidAccountInformation")
const fetchCircleAccount = require("../main/fetchCircleAccount")
const fetchBlindpayAccount = require("../main/fetchBlindpayAccount")
const { fetchReapAccountInformation } = require("../main/fetchReapAccount")
const { BlindpayBankAccountType } = require("../../../blindpay/utils")
const createLog = require("../../../logger/supabaseLogger")
const supabase = require("../../../supabaseClient")
const { fetchYellowcardAccountInformation } = require("../main/fetchYellowcardAccount")

const railFunctionsMap = {
	ONRAMP: {
		USD: {
			ACH: {
				CHECKBOOK: async (accountId) => await fetchPlaidAccountInformation(null, accountId)
			}
		}
	},
	OFFRAMP:{
		USD: {
			ACH: {
				BRIDGE: async (accountId) => await fetchBridgeExternalAccountInformation("usd", null, accountId)
			},
			WIRE: {
				CIRCLE: async (accountId) => await fetchCircleAccount("us", null, accountId), // will be deprecated, but keep it here for now
				BRIDGE: async (accountId) => await fetchBridgeExternalAccountInformation("usd", null, accountId)
			},
			CHATS: {
				REAP: async (accountId) => await fetchReapAccountInformation("usd", null, accountId)
			}
		},
		EUR: {
			SEPA: {
				BRIDGE: async (accountId) => await fetchBridgeExternalAccountInformation("eur", null, accountId)
			}
		},
		BRL: {
			PIX: {
				BLINDPAY: async (accountId) => await fetchBlindpayAccount(BlindpayBankAccountType.PIX, null, accountId)
			},
		},
		MXN: {
			SPEI: {
				BLINDPAY: async (accountId) => await fetchBlindpayAccount(BlindpayBankAccountType.SPEI, null, accountId)
			},
		},
		COP: {
			ACH_COP: {
				BLINDPAY: async (accountId) => await fetchBlindpayAccount(BlindpayBankAccountType.ACH_COP, null, accountId)
			},
		},
		ARS: {
			TRANSFERS: {
				BLINDPAY: async (accountId) => await fetchBlindpayAccount(BlindpayBankAccountType.TRANSFERS, null, accountId)
			}
		},
		HKD: {
			FPS: {
				REAP: async (accountId) => await fetchReapAccountInformation("hkd", null, accountId)
			}
		},
        NGN: {
            BANK_NGN: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("ngn", null, accountId)
            }
        },
        MWK: {
            BANK_MWK: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("mwk", null, accountId)
            }
        },
        TZS: {
            BANK_TZS: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("tzs", null, accountId)
            }
        },
        UGX: {
            BANK_UGX: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("ugx", null, accountId)
            }
        },
        XAF: {
            BANK_XAF: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("xaf", null, accountId)
            }
        },
        KES: {
            MOMO_KES: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("kes", null, accountId)
            }
        },
        RWF: {
            MOMO_RWF: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("rwf", null, accountId)
            }
        },
        XOF: {
            MOMO_XOF: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("xof", null, accountId)
            }
        },
        ZMW: {
            MOMO_ZMW: {
                YELLOWCARD: async (accountId) => await fetchYellowcardAccountInformation("zmw", null, accountId)
            }
        }
	},
}

/**
 * 	
 * Get the function to fetch account information based on the currency, railType, paymentRail, and provider.
 * 
 * @param {string} currency - The currency of the account
 * @param {string} railType - The rail type of the account
 * @param {string} paymentRail - The payment rail of the account
 * @param {string} provider - The provider of the account
 * @returns {Function} - The function to fetch account information
 */
const getRailFunction = (currency, railType, paymentRail, provider) => {

	if(!currency || !railType || !paymentRail || !provider) return null;
	currency = currency.toUpperCase();
	railType = railType.toUpperCase();
	paymentRail = paymentRail.toUpperCase();
	provider = provider.toUpperCase();

	const func = railFunctionsMap[railType]?.[currency]?.[paymentRail]?.[provider];

	// not supposed to happen
	if(!func) throw new Error(`No function found for ${currency} ${railType} ${paymentRail} ${provider}`);

	return func;
}

const accountInfoAggregator = async (funcs) => {
        
	const results = await Promise.all(Object.keys(funcs).map(async (key) => {
            const { func, accountId, currency, railType, paymentRail } = funcs[key];
            let accountInfo = await func(accountId); // this will always be one account object

			if(!accountInfo) return { count: 0, banks: [] };
			
			accountInfo.accountId = key;
			accountInfo.rail = {
				currency,
				railType,
				paymentRail				
			}

            return {
                count: 1,
                banks: [accountInfo]
            };
            
        }));

		const allBanks = results.reduce((acc, curr) => {
			acc.push(...curr.banks);
			return acc;
		}, []);

        return {
			count: allBanks.length,
			banks: allBanks
		};
    
}

/**
 * 
 * Get the account information for the given accounts
 * 
 * @param {Array<Object>} accounts - The accounts to get information for
 * @returns {Object} - The accounts information
 */
const getAccountsInfo = async (accounts) => {
	const funcs = accounts.reduce((acc, account) => {
		const obj = {
			func: getRailFunction(account.currency, account.rail_type, account.payment_rail, account.provider),
			accountId: account.account_id,
			currency: account.currency,
			railType: account.rail_type,
			paymentRail: account.payment_rail
		}
		acc[account.id] = obj;
		return acc;
		}, {});
	return await accountInfoAggregator(funcs);
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
	getAccountsInfo,
	getFetchOnRampVirtualAccountFunctions,
}