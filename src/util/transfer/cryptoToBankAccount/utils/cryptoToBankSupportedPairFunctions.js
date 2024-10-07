const { createBridgeDirectCryptoToFiatTransfer } = require("../transfer/createBridgeDirectCryptoToFiatTransfer");
const { createReapCryptoToFiatTransfer, acceptReapCryptoToFiatTransfer, executeAsyncTransferCryptoToFiat: executeReapAsyncTransferCryptoToFiat } = require("../transfer/createReapCryptoToFiatTransfer");
const { createYellowcardCryptoToFiatTransfer, acceptYellowcardCryptoToFiatTransfer } = require("../transfer/createYellowcardCryptoToFiatTransfer");
const transferToBlindpaySmartContract = require("../transfer/transferToBlindpaySmartContract_DEP");
const { createTransferToBlindpaySmartContract, acceptBlindpayCryptoToFiatTransfer, executeAsyncBlindpayTransferCryptoToFiat } = require("../transfer/transferToBlindpaySmartContractV2");

// const { transferToBridgeLiquidationAddress, transferToBridgeLiquidationAddressDeveloperWithdraw } = require("../transfer/transferToBridgeLiquidationAddress_DEP");
const { createTransferToBridgeLiquidationAddress, executeAsyncTransferCryptoToFiat: executeBridgeAsyncTransferCryptoToFiat } = require("../transfer/transferToBridgeLiquidationAddressV2");

const transferToCircleWallet = require("../transfer/transferToCircleWallet");

const { validateBlindPayTransferParams, validateReapTransferParams, validateBridgeTransferParams } = require("./fieldValidationFunctions");

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
				validationFunc: validateBridgeTransferParams
			},
		}
	},
	ach: {
		usdc: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer,
				validationFunc: validateBridgeTransferParams
			},
		},
		usdt: {
			usd: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: createBridgeDirectCryptoToFiatTransfer,
				validationFunc: validateBridgeTransferParams
			},
		}
	},
	sepa: {
		usdc: {
			eur: {
				transferFunc: createTransferToBridgeLiquidationAddress,
				asyncTransferExecuteFunc: executeBridgeAsyncTransferCryptoToFiat,
				directWithdrawFunc: null,
				validationFunc: validateBridgeTransferParams
			},
		}
	},
	pix: {
		usdc: {
			brl: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	spei_bitso: {
		usdc: {
			mxn: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	transfers_bitso: {
		usdc: {
			ars: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	ach_cop_bitso: {
		usdc: {
			cop: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	spei_bitso: {
		usdc: {
			mxn: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	transfers_bitso: {
		usdc: {
			ars: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	ach_cop_bitso: {
		usdc: {
			cop: {
				transferFunc: createTransferToBlindpaySmartContract,
				acceptQuoteFunc: acceptBlindpayCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeAsyncBlindpayTransferCryptoToFiat,
				validationFunc: validateBlindPayTransferParams
			},
		}
	},
	fps: {
		usdc: {
			hkd: {
				transferFunc: createReapCryptoToFiatTransfer,
				acceptQuoteFunc: acceptReapCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeReapAsyncTransferCryptoToFiat,
				validationFunc: validateReapTransferParams
			},
		}
	},
	chats: {
		usdc: {
			usd: {
				transferFunc: createReapCryptoToFiatTransfer,
				acceptQuoteFunc: acceptReapCryptoToFiatTransfer,
				asyncTransferExecuteFunc: executeReapAsyncTransferCryptoToFiat,
				validationFunc: validateReapTransferParams
			},
		}
	},
	momo_mpesa: {
		usdc: {
			kes: {
				transferFunc: createYellowcardCryptoToFiatTransfer,
				acceptQuoteFunc: acceptYellowcardCryptoToFiatTransfer,
				validationFunc: validateYellowCardTransferParams
				//TODO - implement executeAsyncTransferCryptoToFiat
				// asyncTransferExecuteFunc: executeReapAsyncTransferCryptoToFiat
			},
		}
	}
}

module.exports = CryptoToBankSupportedPairCheck