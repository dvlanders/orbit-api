const { createBridgeDirectCryptoToFiatTransfer } = require("../transfer/createBridgeDirectCryptoToFiatTransfer");
const { createReapCryptoToFiatTransfer, acceptReapCryptoToFiatTransfer, executeAsyncTransferCryptoToFiat: executeReapAsyncTransferCryptoToFiat } = require("../transfer/createReapCryptoToFiatTransfer");
const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract");

const { transferToBridgeLiquidationAddress, transferToBridgeLiquidationAddressDeveloperWithdraw } = require("../transfer/transferToBridgeLiquidationAddress");
const { createTransferToBridgeLiquidationAddress, executeAsyncTransferCryptoToFiat: executeBridgeAsyncTransferCryptoToFiat } = require("../transfer/transferToBridgeLiquidationAddressV2");

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
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
			},
		}
	},
	ach: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		},
		usdt: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		}
	},
	sameDayAch: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		},
		usdt: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
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
				asyncTransferExecuteFunc: executeReapAsyncTransferCryptoToFiat
			},
		}
	},
	chats: {
		usdc: {
			usd: {
				transferFunc: createReapCryptoToFiatTransfer,
				acceptQuoteFunc: acceptReapCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeReapAsyncTransferCryptoToFiat
			},
		}
	}
}

module.exports = CryptoToBankSupportedPairCheck