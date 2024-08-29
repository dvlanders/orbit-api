const { createBridgeDirectCryptoToFiatTransfer } = require("../transfer/createBridgeDirectCryptoToFiatTransfer");
const { createReapCryptoToFiatTransfer, acceptReapCryptoToFiatTransfer } = require("../transfer/createReapCryptoToFiatTransfer");
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
				directWithdrawFunc: null
			},
		}
	},
	ach: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		},
		usdt: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		}
	},
	sameDayAch: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		},
		usdt: {
			usd: {
				transferFunc: null,
				asyncTransferExecuteFunc: null,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeAsyncTransferCryptoToFiat,
				directWithdrawFunc: null
			},
		}
	},
	pix: {
		usdc: {
			brl: {
				transferFunc: transferToBlindpaySmartContract,
				directWithdrawFunc: null
			},
		}
	},
	fps: {
		usdc: {
			hkd: {
				transferFunc: createReapCryptoToFiatTransfer,
				acceptQuoteFunc: acceptReapCryptoToFiatTransfer,
				asyncTransferExecuteFunc: null
			},
		}
	},
	chats: {
		usdc: {
			usd: {
				transferFunc: createReapCryptoToFiatTransfer,
				acceptQuoteFunc: acceptReapCryptoToFiatTransfer,
				asyncTransferExecuteFunc: null
			},
		}
	}
}

module.exports = CryptoToBankSupportedPairCheck