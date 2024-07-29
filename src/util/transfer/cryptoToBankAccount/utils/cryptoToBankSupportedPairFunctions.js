const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract");

const transferToBridgeLiquidationAddress = require("../transfer/transferToBridgeLiquidationAddress");
const transferToCircleWallet = require("../transfer/transferToCircleWallet");

const CryptoToBankSupportedPairCheck = (paymentRail, sourceCurrency, destinationCurrency) => {
	try {
		return CryptoToBankSupportedPairFunctions[paymentRail][sourceCurrency][destinationCurrency]
	} catch (error) {
		return null
	}
}

const CryptoToBankSupportedPairFunctions = {
	wire: {
		usdc: {
			usd: {
				transferFunc: transferToCircleWallet,
			},
		}
	},
	ach: {
		usdc: {
			usd: {
				transferFunc: transferToBridgeLiquidationAddress,
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: transferToBridgeLiquidationAddress,
			},
		}
	},
	pix: {
		usdc: {
			brl: {
				transferFunc: transferToBlindpaySmartContract,
			},
		}
	}
}

module.exports = CryptoToBankSupportedPairCheck