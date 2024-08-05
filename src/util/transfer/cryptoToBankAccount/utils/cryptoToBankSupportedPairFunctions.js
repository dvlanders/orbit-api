const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract");

const {transferToBridgeLiquidationAddress, transferToBridgeLiquidationAddressDeveloperWithdraw} = require("../transfer/transferToBridgeLiquidationAddress");
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
				developerWithdrawFunc: transferToBridgeLiquidationAddressDeveloperWithdraw
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: transferToBridgeLiquidationAddress,
				developerWithdrawFunc: transferToBridgeLiquidationAddressDeveloperWithdraw
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