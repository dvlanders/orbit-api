const activateUsAchOnRampRail = require("./usAch")

const OnRampRail = {
	US_ACH_WIRE: "US_ACH_WIRE",
	EU_SEPA: "EU_SEPA"
}

const supportedRail = new Set([OnRampRail.US_ACH_WIRE])

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
	US_ACH_WIRE: {
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