const { POLYGON_AMOY } = require("../../transfer/cryptoToCrypto/utils/cryptoToCryptoSupportedFunctions")
const activateUsAchOnRampRail = require("./usAch")

const OnRampRail = {
	US_ACH: "US_ACH",
	EU_SEPA: "EU_SEPA"
}

const supportedRail = new Set([OnRampRail.US_ACH])

const activateOnRampRailFunctionsCheck = (fiatRail, destinationChain, destinationCurrency) => {
	try {
		return activateOnRampRailFunctions[fiatRail][destinationChain][destinationCurrency]
	} catch (error) {
		return null
	}
}

/**
 * The input for function should at least contain userId, destinationCurrency, destinationChain
 */
const activateOnRampRailFunctions = {
	US_ACH: {
		POLYGON_AMOY: {
			usdc: activateUsAchOnRampRail
		},
		POLYGON_MAINNET: {
			usdc: activateUsAchOnRampRail
		},
		ETHEREUM_MAINNET: {
			usdc: activateUsAchOnRampRail,
			usdt: activateUsAchOnRampRail,
		},
		OPTIMISM_MAINNET: {
			usdc: activateUsAchOnRampRail,
		},
		BASE_MAINNET: {
			usdc: activateUsAchOnRampRail,
		}
	}
}

module.exports = {
	OnRampRail,
	supportedRail,
	activateOnRampRailFunctionsCheck
}