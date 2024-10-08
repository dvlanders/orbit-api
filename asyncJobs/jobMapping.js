const { createUserAsyncCheck, createUserAsync } = require("./user/createUser");
const { fundGas, fundGasScheduleCheck } = require("./wallets/fundGas");
const { updateUserAsyncCheck, updateUserAsync } = require("./user/updateUser");
const { createDeveloperUserAsyncCheck, createDeveloperUserAsync } = require("./user/createDeveloperUser")
const { approveMaxTokenToPaymentProcessorAsyncCheck, approveMaxTokenToPaymentProcessorAsync } = require("./wallets/approveMaxToPaymentProcessor");
const { cryptoToCryptoTransferScheduleCheck } = require("./transfer/cryptoTocryptoTransfer/scheduleCheck");
const { cryptoToCryptoTransferAsync } = require("./transfer/cryptoTocryptoTransfer/cryptoToCryptoTransfer");
const { cryptoToFiatTransferScheduleCheck } = require("./transfer/cryptoToFiatTransfer/scheduleCheck");
const { cryptoToFiatTransferAsync } = require("./transfer/cryptoToFiatTransfer/cryptoToFiatTransfer");
const { chargeFeeOnFundReceivedScheduleCheck } = require("./transfer/chargeFeeOnFundReceivedBastion/scheduleCheck");
const { chargeFeeOnFundReceivedAsync } = require("./transfer/chargeFeeOnFundReceivedBastion/chargeFeeOnFundReceived");
const { executeBlindpayPayoutScheduleCheck } = require("./transfer/executeBlindpayPayout/scheduleCheck");
const { executeBlindpayPayout } = require("./transfer/executeBlindpayPayout/executeBlindpayPayout");
const { updateDeveloperUserAsyncCheck, updateDeveloperUserAsync } = require("./user/updateDeveloperUser");
const { mintCheckScheduleCheck, mintScheduleCheck } = require("./sandbox/mint/scheduleCheck");
const { mint, mintCheck } = require("./sandbox/mint/mint");
const { cryptoToFiatTransferSandboxScheduleCheck } = require("./sandbox/cryptoToFiatTransfer/scheduleCheck");
const { cryptoToFiatTransferSandboxAsync } = require("./sandbox/cryptoToFiatTransfer/cryptoToFiatTransfer");
const { cryptoToCryptoTransferSandboxScheduleCheck } = require("./sandbox/cryptoToCryptoTransfer/scheduleCheck");
const { cryptoToCryptoTransferSandboxAsync } = require("./sandbox/cryptoToCryptoTransfer/cryptoToCryptoTransfer");
const { retryBridgeCustomerCreation, retryBridgeCustomerCreationCheck } = require("./user/retryBridgeCustomerCreation");
const { baseAssetWithdrawAsyncScheduleCheck } = require("./transfer/baseAssetWithdraw/scheduleCheck");
const { baseAssetWithdrawAsync } = require("./transfer/baseAssetWithdraw/baseAssetWithdraw");


exports.jobMapping = {
	fundGas: {
		scheduleCheck: fundGasScheduleCheck,
		execute: fundGas
	},
	createUser: {
		scheduleCheck: createUserAsyncCheck,
		execute: createUserAsync
	},
	updateUser: {
		scheduleCheck: updateUserAsyncCheck,
		execute: updateUserAsync
	},
	createDeveloperUser: {
		scheduleCheck: createDeveloperUserAsyncCheck,
		execute: createDeveloperUserAsync
	},
	approveMaxTokenToPaymentProcessor: {
		scheduleCheck: approveMaxTokenToPaymentProcessorAsyncCheck,
		execute: approveMaxTokenToPaymentProcessorAsync
	},
	cryptoToCryptoTransfer: {
		scheduleCheck: cryptoToCryptoTransferScheduleCheck,
		execute: cryptoToCryptoTransferAsync
	},
	cryptoToFiatTransfer: {
		scheduleCheck: cryptoToFiatTransferScheduleCheck,
		execute: cryptoToFiatTransferAsync,
	},
	chargeFeeOnFundReceived: {
		scheduleCheck: chargeFeeOnFundReceivedScheduleCheck,
		execute: chargeFeeOnFundReceivedAsync,
	},
	executeBlindpayPayout: {
		scheduleCheck: executeBlindpayPayoutScheduleCheck,
		execute: executeBlindpayPayout
	},
	updateDeveloperUser: {
		scheduleCheck: updateDeveloperUserAsyncCheck,
		execute: updateDeveloperUserAsync
	},
	mint: {
		scheduleCheck: mintScheduleCheck,
		execute: mint
	},
	mintCheck: {
		scheduleCheck: mintCheckScheduleCheck,
		execute: mintCheck
	},
	cryptoToFiatTransferSandbox:{
		scheduleCheck: cryptoToFiatTransferSandboxScheduleCheck,
		execute: cryptoToFiatTransferSandboxAsync
	},
	cryptoToCryptoTransferSandbox: {
		scheduleCheck: cryptoToCryptoTransferSandboxScheduleCheck,
		execute: cryptoToCryptoTransferSandboxAsync
	},
	retryBridgeCustomerCreation: {
		scheduleCheck: retryBridgeCustomerCreationCheck,
		execute: retryBridgeCustomerCreation
	},
	baseAssetWithdraw: {
		scheduleCheck: baseAssetWithdrawAsyncScheduleCheck,
		execute: baseAssetWithdrawAsync
	}

}

