const { createUserAsyncCheck, createUserAsync } = require("./user/createUser");
const { fundGas } = require("./wallets/fundGas");
const { updateUserAsync } = require("./user/updateUser");
const { createDeveloperUserAsync } = require("./user/createDeveloperUser")
const { approveMaxTokenToPaymentProcessorAsync } = require("./wallets/approveMaxToPaymentProcessor");
const { cryptoToCryptoTransferAsync } = require("./transfer/cryptoTocryptoTransfer/cryptoToCryptoTransfer");
const { cryptoToFiatTransferAsync } = require("./transfer/cryptoToFiatTransfer/cryptoToFiatTransfer");
const { chargeFeeOnFundReceivedAsync } = require("./transfer/chargeFeeOnFundReceivedBastion/chargeFeeOnFundReceived");
const { executeBlindpayPayout } = require("./transfer/executeBlindpayPayout/executeBlindpayPayout");
const { updateDeveloperUserAsync } = require("./user/updateDeveloperUser");
const { mint, mintCheck } = require("./sandbox/mint/mint");
const { cryptoToFiatTransferSandboxAsync } = require("./sandbox/cryptoToFiatTransfer/cryptoToFiatTransfer");
const { cryptoToCryptoTransferSandboxAsync } = require("./sandbox/cryptoToCryptoTransfer/cryptoToCryptoTransfer");
const { retryBridgeCustomerCreation, retryBridgeCustomerCreationCheck } = require("./user/retryBridgeCustomerCreation");
const { baseAssetWithdrawAsync } = require("./transfer/baseAssetWithdraw/baseAssetWithdraw");
const { bridgeUsdc } = require("./bridging/cctp/bridgeUsdc");
const { reapApproveFundsAsync } = require("./transfer/cryptoToFiatTransfer/reap/approveFunds");


exports.jobMapping = {
	fundGas: {
		execute: fundGas
	},
	createUser: {
		scheduleCheck: createUserAsyncCheck,
		execute: createUserAsync
	},
	updateUser: {
		execute: updateUserAsync
	},
	createDeveloperUser: {
		execute: createDeveloperUserAsync
	},
	approveMaxTokenToPaymentProcessor: {
		execute: approveMaxTokenToPaymentProcessorAsync
	},
	cryptoToCryptoTransfer: {
		execute: cryptoToCryptoTransferAsync
	},
	cryptoToFiatTransfer: {
		execute: cryptoToFiatTransferAsync,
	},
	chargeFeeOnFundReceived: {
		execute: chargeFeeOnFundReceivedAsync,
	},
	executeBlindpayPayout: {
		execute: executeBlindpayPayout
	},
	updateDeveloperUser: {
		execute: updateDeveloperUserAsync
	},
	mint: {
		execute: mint
	},
	mintCheck: {
		execute: mintCheck
	},
	cryptoToFiatTransferSandbox:{
		execute: cryptoToFiatTransferSandboxAsync
	},
	cryptoToCryptoTransferSandbox: {
		execute: cryptoToCryptoTransferSandboxAsync
	},
	retryBridgeCustomerCreation: {
		scheduleCheck: retryBridgeCustomerCreationCheck,
		execute: retryBridgeCustomerCreation
	},
	baseAssetWithdraw: {
		execute: baseAssetWithdrawAsync
	},
	bridgeUsdc: {
		execute: bridgeUsdc
	},
	reapApproveFunds: {
		execute: reapApproveFundsAsync
	}
}

