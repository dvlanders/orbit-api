const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract");

const {transferToBridgeLiquidationAddress, transferToBridgeLiquidationAddressDeveloperWithdraw} = require("../transfer/transferToBridgeLiquidationAddress");
const {createTransferToBridgeLiquidationAddress} = require("../transfer/transferToBridgeLiquidationAddressV2");

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
				transferFunc: createTransferToBridgeLiquidationAddress,
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: createTransferToBridgeLiquidationAddress,
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