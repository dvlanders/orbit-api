const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract");

const { transferToBridgeLiquidationAddress, transferToBridgeLiquidationAddressDeveloperWithdraw } = require("../transfer/transferToBridgeLiquidationAddress");
const { createTransferToBridgeLiquidationAddress, executeAsyncTransferCryptoToFiat } = require("../transfer/transferToBridgeLiquidationAddressV2");

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
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat
			},
		}
	},
	sameDayAch: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat
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