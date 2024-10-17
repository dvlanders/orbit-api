const supabase = require("../util/supabaseClient");
const { fieldsValidation, isUUID } = require("../util/common/fieldsValidation");
const { isValidLimit, isValidDateRange, isValidDate, isValidTransferType, TransferType } = require("../util/common/transferValidation");
const { requiredFields, acceptedFields, supportedCurrency } = require("../util/transfer/cryptoToCrypto/utils/createTransfer");
const createLog = require("../util/logger/supabaseLogger");
const { hifiSupportedChain, currencyDecimal, Chain } = require("../util/common/blockchain");
const { isBastionKycPassed, isBridgeKycPassed, isBastionKycPassedDeveloperUser } = require("../util/common/privilegeCheck");
const { checkIsCryptoToCryptoRequestIdAlreadyUsed } = require("../util/transfer/cryptoToCrypto/utils/fetchRequestInformation");
const { transfer, CreateCryptoToCryptoTransferErrorType, CreateCryptoToCryptoTransferError } = require("../util/transfer/cryptoToCrypto/main/bastionTransfer");
const { fetchUserWalletInformation } = require("../util/transfer/cryptoToCrypto/utils/fetchUserWalletInformation");
const fetch = require('node-fetch');
// const { fieldsValidation } = require("../util/common/fieldsValidation");
const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');
const { verifyUser } = require("../util/helper/verifyUser");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../util/transfer/cryptoToBankAccount/utils/createTransfer");
const FiatToCryptoSupportedPairFunctionsCheck = require("../util/transfer/fiatToCrypto/utils/fiatToCryptoSupportedPairFunctions");
const FiatToFiatSupportedPairFunctionsCheck = require("../util/transfer/fiatToFiat/utils/fiatToFiatSupportedPairFunctions");
const { checkIsFiatToFiatRequestIdAlreadyUsed, fetchFiatToFiatProvidersInformationById } = require("../util/transfer/fiatToFiat/utils/fiatToFiatTransactionService");
const { CreateFiatToFiatTransferError, CreateFiatToFiatTransferErrorType } = require("../util/transfer/fiatToFiat/utils/utils");
const FiatToFiatSupportedPairFetchFunctionsCheck = require("../util/transfer/fiatToFiat/utils/fiatToFiatSupportedPairFetchFunctions");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../util/transfer/fiatToCrypto/utils/utils");
const { checkIsCryptoToFiatRequestIdAlreadyUsed, fetchCryptoToFiatRequestInfortmaionById, fetchCryptoToFiatProvidersInformationById } = require("../util/transfer/cryptoToBankAccount/utils/fetchRequestInformation");
const { checkIsFiatToCryptoRequestIdAlreadyUsed, fetchFiatToCryptoProvidersInformationById } = require("../util/transfer/fiatToCrypto/utils/fetchRequestInformation");
const fetchFiatToCryptoTransferRecord = require("../util/transfer/fiatToCrypto/transfer/fetchCheckbookBridgeFiatToCryptoTransferRecord");
const fetchCryptoToCryptoTransferRecord = require("../util/transfer/cryptoToCrypto/main/fetchTransferRecord");
const cryptoToCryptoSupportedFunctions = require("../util/transfer/cryptoToCrypto/utils/cryptoToCryptoSupportedFunctions");
const CryptoToBankSupportedPairCheck = require("../util/transfer/cryptoToBankAccount/utils/cryptoToBankSupportedPairFunctions");
const { FetchCryptoToBankSupportedPairCheck } = require("../util/transfer/cryptoToBankAccount/utils/cryptoToBankSupportedPairFetchFunctions");
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("../util/transfer/fiatToCrypto/utils/fiatToCryptoSupportedPairFetchFunctions");
const fetchAllCryptoToCryptoTransferRecord = require("../util/transfer/cryptoToCrypto/main/fetchAllTransferRecord");
const fetchAllCryptoToFiatTransferRecord = require("../util/transfer/cryptoToBankAccount/transfer/fetchAllCryptoToFiatTransferRecord");
const fetchAllFiatToCryptoTransferRecord = require("../util/transfer/fiatToCrypto/transfer/fetchAllFiatToCryptoTransferRecords");
const { getBastionWallet } = require("../util/bastion/utils/getBastionWallet");
const { acceptedFeeType, canChargeFee } = require("../util/transfer/fee/utils");
const { isNumberOrNumericString } = require("../util/helper/numberCheck");
const getCryptoToFiatConversionRateFunction = require("../util/transfer/conversionRate/utils/cryptoToFiatConversionRateProvider");
const { fetchAccountProviders } = require("../util/account/accountProviders/accountProvidersService");
const { walletType, allowedWalletTypes } = require("../util/transfer/utils/walletType");
const { cryptoToFiatAmountCheck } = require("../util/transfer/cryptoToBankAccount/utils/check");
const { transferObjectReconstructor, transferRecordsAggregator } = require("../util/transfer/utils/transfer");
const { isInRange, isValidAmount, isHIFISupportedChain, inStringEnum } = require("../util/common/filedValidationCheckFunctions");
const { createSandboxCryptoToFiatTransfer } = require("../util/transfer/cryptoToBankAccount/transfer/sandboxCryptoToFiatTransfer");
const sandboxMintUSDHIFI = require("../util/transfer/fiatToCrypto/transfer/sandboxMintUSDHIFI");
const { createBastionSandboxCryptoTransfer } = require("../util/transfer/cryptoToCrypto/main/bastionTransfeSandboxUSDHIFI");
const { insertTransactionFeeRecord } = require("../util/billing/fee/feeTransactionService");
const { transferType } = require("../util/transfer/utils/transfer");
const { createUsdcBridgingRequest } = require("../util/transfer/bridging/createUsdcBridingRequest");
const { checkIsBridgingRequestIdAlreadyUsed } = require("../util/transfer/bridging/fetchRequestInformation");
const fetchBridgingTransactions = require("../util/transfer/bridging/fetchBridgingTransactions");


exports.createCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// should gather senderUserId, profileId, amount, requestId, recipientUserId, recipientAddress, chain
	const { profileId } = req.query
	const fields = req.body
	const { senderUserId, amount, requestId, recipientUserId, recipientAddress, chain, currency, feeType, feeValue, senderWalletType, recipientWalletType } = fields


	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
		fields.profileId = profileId
		// check if fee config is correct
		if (feeType || feeValue) {
			const { valid, error } = await canChargeFee(profileId, feeType, feeValue)
			if (!valid) return res.status(400).json({ error })
		}
		//check if sender is under profileId
		if (!(await verifyUser(senderUserId, profileId))) return res.status(401).json({ error: "senderUserId not found" })
		// check if provide either recipientUserId or recipientAddress
		if (!recipientUserId && !recipientAddress) return res.status(400).json({ error: `Should provide either recipientUserId or recipientAddress` })
		if (recipientUserId && recipientAddress) return res.status(400).json({ error: `Should only provide either recipientUserId or recipientAddress` })
		// check if chain is supported
		if (!(chain in cryptoToCryptoSupportedFunctions)) return res.status(400).json({ error: `Chain ${chain} is not supported` })
		// check if currency is supported
		if (!(currency in cryptoToCryptoSupportedFunctions[chain])) return res.status(400).json({ error: `Currency ${currency} is not supported` })
		// check is request id valid
		if (!isUUID(requestId)) return res.status(400).json({ error: "invalid requestId" })
		// check is request_id exist
		const { isAlreadyUsed, newRecord } = await checkIsCryptoToCryptoRequestIdAlreadyUsed(requestId, senderUserId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })
		const feeTransaction = await insertTransactionFeeRecord({ transaction_id: newRecord.id, transaction_type: transferType.CRYPTO_TO_CRYPTO, status: "CREATED" });

		// fetch sender wallet address information
		if (senderWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
		if (senderWalletType && !allowedWalletTypes.includes(senderWalletType)) return res.status(400).json({ error: `wallet type ${senderWalletType} is not supported` })
		const _senderWalletType = senderWalletType || "INDIVIDUAL"
		const { walletAddress: senderAddress, bastionUserId: senderBastionUserId } = await getBastionWallet(senderUserId, chain, _senderWalletType)
		if (!senderAddress || !senderBastionUserId) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })
		fields.senderAddress = senderAddress
		fields.senderBastionUserId = senderBastionUserId
		fields.feeTransactionId = feeTransaction.id
		// check privilege
		if (!(await isBastionKycPassed(senderBastionUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })

		// check recipient wallet address if using recipientUserId
		if (recipientUserId) {
			if (recipientWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
			if (recipientWalletType && !allowedWalletTypes.includes(recipientWalletType)) return res.status(400).json({ error: `wallet type ${recipientWalletType} is not supported` })
			const _recipientWalletType = recipientWalletType || "INDIVIDUAL"
			const { walletAddress: recipientAddress, bastionUserId: recipientBastionUserId } = await getBastionWallet(recipientUserId, chain, _recipientWalletType)
			if (!recipientAddress || !recipientBastionUserId) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })
			fields.recipientAddress = recipientAddress
			fields.recipientBastionUserId = recipientBastionUserId
			if (!(await isBastionKycPassed(recipientBastionUserId))) return res.status(400).json({ error: `User is not allowed to accept crypto` })
		}


		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && currency == "usdHifi") {
			const receipt = await createBastionSandboxCryptoTransfer(fields)
			return res.status(200).json(receipt)
		}

		// get transfer function
		const { transferFunc } = cryptoToCryptoSupportedFunctions[chain][currency]
		// transfer
		const receipt = await transferFunc(fields)

		return res.status(200).json(receipt)
	} catch (error) {
		if (error instanceof CreateCryptoToCryptoTransferError) {
			if (error.type == CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		await createLog("transfer/createCryptoToCryptoTransfer", senderUserId, error.message, error, null, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.getAllCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fields = req.query
	const { profileId, userId, limit, createdAfter, createdBefore } = fields
	const requiredFields = []
	const acceptedFields = { userId: (value) => isUUID(value), limit: (value) => isInRange(value, 1, 100), createdAfter: (value) => isValidDate(value), createdBefore: (value) => isValidDate(value), profileId: "string" }

	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
		if (limit && !isValidLimit(limit)) return res.status(400).json({ error: "Invalid limit" })
		if ((createdAfter && !isValidDate(createdAfter)) ||
			(createdBefore && !isValidDate(createdBefore)) ||
			(createdAfter && createdBefore && !isValidDateRange(createdAfter, createdBefore))) {
			return res.status(400).json({ error: "Invalid date range" });
		}

		// get all records
		const records = await fetchAllCryptoToCryptoTransferRecord(profileId, userId, limit, createdAfter, createdBefore)
		return res.status(200).json(records)

	} catch (error) {
		console.error(error)
		await createLog("transfer/getAllCryptoToCryptoTransfer", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.getCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { id, profileId } = req.query



	try {
		if (!id || !isUUID(id)) return res.status(404).json({ error: `No transaction found for id: ${id}` })

		// check if requestRecord exist
		const transactionRecord = await fetchCryptoToCryptoTransferRecord(id, profileId)
		if (!transactionRecord) return res.status(404).json({ error: `No transaction found for id: ${id}` })
		return res.status(200).json(transactionRecord)

	} catch (error) {
		await createLog("transfer/getCryptoToCryptoTransfer", null, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.createCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const { profileId } = req.query
	let { requestId, destinationAccountId, amount, chain, sourceCurrency, destinationCurrency, sourceUserId, description, purposeOfPayment, paymentRail, feeType, feeValue, sourceWalletType, sameDayAch, receivedAmount, achReference, sepaReference, wireMessage, swiftReference } = fields

	try {
		// field validation
		const requiredFields = ["requestId", "sourceUserId", "destinationAccountId", "chain", "sourceCurrency", "destinationCurrency"]
		const acceptedFields = {
			"feeType": (value) => inStringEnum(value, ["FIX", "PERCENT"]),
			"feeValue": (value) => isValidAmount(value),
			"receivedAmount": (value) => isValidAmount(value),
			"requestId": (value) => isUUID(value),
			"sourceUserId": (value) => isUUID(value),
			"destinationUserId": (value) => isUUID(value),
			"receivedAmount": (value) => isValidAmount(value),
			"destinationAccountId": (value) => isUUID(value),
			"amount": (value) => isValidAmount(value),
			"chain": (value) => isHIFISupportedChain(value),
			"sourceCurrency": (value) => inStringEnum(value, ["usdc", "usdt", "usdHifi"]),
			"destinationCurrency": (value) => inStringEnum(value, ["usd", "eur", "brl", "hkd", "mxn", "cop", "ars", "kes", "ngn", "xof"]),
			"paymentRail": "string",
			"description": "string",
			"purposeOfPayment": "string",
			"sourceWalletType": (value) => inStringEnum(value, ["INDIVIDUAL", "FEE_COLLECTION", "PREFUNDED"]),
			"sameDayAch": "boolean",
			"achReference": "string",
			"sepaReference": "string",
			"wireMessage": "string",
			"swiftReference": "string"
		}

		const { missingFields, invalidFields } = fieldsValidation({ ...fields }, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}

		if (!amount && !receivedAmount) return res.status(401).json({ error: "Either amount and receivedAmount is required" })
		if (!(await verifyUser(sourceUserId, profileId))) return res.status(401).json({ error: "sourceUserId not found" })

		const { isAlreadyUsed, newRecord } = await checkIsCryptoToFiatRequestIdAlreadyUsed(requestId, profileId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })
		const feeTransaction = await insertTransactionFeeRecord({ transaction_id: newRecord.id, transaction_type: transferType.CRYPTO_TO_FIAT, status: "CREATED" });

		// FIX ME SHOULD put it in the field validation 
		if (amount && !isNumberOrNumericString(amount)) return res.status(400).json({ error: "Invalid amount" })
		if (receivedAmount && !isNumberOrNumericString(receivedAmount)) return res.status(400).json({ error: "Invalid receivedAmount" })
		if (amount && !cryptoToFiatAmountCheck(amount, sourceCurrency, chain)) return res.status(400).json({ error: "Invalid amount for sourceCurrency" })

		// check if fee config is correct
		if (feeType || feeValue) {
			const { valid, error } = await canChargeFee(profileId, feeType, feeValue)
			if (!valid) return res.status(400).json({ error })
		}

		// check is chain supported
		if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Unsupported chain: ${chain}` });

		// get account info
		const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)

		if (!accountInfo || !accountInfo.account_id) return res.status(400).json({ error: `destinationAccountId does not exist` });
		if (accountInfo.rail_type != "offramp") return res.status(400).json({ error: `destinationAccountId is not a offramp bank account` });
		if (accountInfo.currency != destinationCurrency) return res.status(400).json({ error: `destinationCurrency not allowed for destinationAccountId` });
		if (paymentRail && accountInfo.payment_rail != paymentRail) return res.status(400).json({ error: `paymentRail not allowed for destinationAccountId` });
		if (!paymentRail) paymentRail = accountInfo.payment_rail;
		fields.accountInfo = accountInfo
		const destinationUserId = accountInfo.user_id
		fields.destinationUserId = destinationUserId

		// block if destination user is not equal to source user
		if (destinationUserId != sourceUserId) return res.status(400).json({ error: `destinationUserId is not equal to sourceUserId` });

		// get user wallet
		// fetch sender wallet address information
		if (sourceWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
		if (sourceWalletType && !allowedWalletTypes.includes(sourceWalletType)) return res.status(400).json({ error: `wallet type ${sourceWalletType} is not supported` })
		const _sourceWalletType = sourceWalletType || "INDIVIDUAL"
		const { walletAddress: sourceWalletAddress, bastionUserId: sourceBastionUserId } = await getBastionWallet(sourceUserId, chain, _sourceWalletType)
		if (!sourceWalletAddress || !sourceBastionUserId) {
			return res.status(400).json({ error: `No user wallet found for chain: ${chain}` })
		}

		if (!(await isBastionKycPassed(sourceBastionUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })
		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && sourceCurrency == "usdHifi") {
			const { isExternalAccountExist, transferResult } = await createSandboxCryptoToFiatTransfer({ requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, paymentRail, sourceBastionUserId, sourceWalletType: _sourceWalletType, destinationUserId, description, purposeOfPayment, receivedAmount, achReference, sepaReference, wireMessage, swiftReference, feeTransactionId: feeTransaction.id })
			if (!isExternalAccountExist) return res.status(400).json({ error: `Invalid destinationAccountId or unsupported rail for provided destinationAccountId` });
			const receipt = await transferObjectReconstructor(transferResult, destinationAccountId);
			return res.status(200).json(receipt);
		}

		//check is source-destination pair supported
		const funcs = CryptoToBankSupportedPairCheck(paymentRail, sourceCurrency, destinationCurrency)
		if (!funcs) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });
		const { transferFunc, validationFunc } = funcs
		if (!transferFunc || !validationFunc) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });

		const validationRes = await validationFunc({ amount, feeType, feeValue, paymentRail, sameDayAch });
		if (!validationRes.valid) return res.status(400).json({ error: `fields provided are invalid`, invalidFieldsAndMessages: validationRes.invalidFieldsAndMessages })

		const { isExternalAccountExist, transferResult } = await transferFunc({ requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, paymentRail, sameDayAch, sourceBastionUserId, sourceWalletType: _sourceWalletType, destinationUserId, description, purposeOfPayment, receivedAmount, achReference, sepaReference, wireMessage, swiftReference, accountInfo, feeTransactionId: feeTransaction.id })
		if (!isExternalAccountExist) return res.status(400).json({ error: `Invalid destinationAccountId or unsupported rail for provided destinationAccountId` });
		const receipt = await transferObjectReconstructor(transferResult, destinationAccountId);

		return res.status(200).json(receipt);

	} catch (error) {

		if (error instanceof CreateCryptoToBankTransferError) {
			if (error.type == CreateCryptoToBankTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "An unexpected error occurred" })
			}
		}
		console.log(error)
		await createLog("transfer/crypto-to-fiat", sourceUserId, error.message, error, null, res)
		return res.status(500).json({ error: 'An unexpected error occurred' });
	}
}

exports.getAllCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fields = req.query
	const { profileId, userId, limit, createdAfter, createdBefore } = fields
	const requiredFields = []
	const acceptedFields = { userId: (value) => isUUID(value), limit: (value) => isInRange(value, 1, 100), createdAfter: (value) => isValidDate(value), createdBefore: (value) => isValidDate(value), profileId: "string" }

	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
		if (limit && !isValidLimit(limit)) return res.status(400).json({ error: "Invalid limit" })
		if ((createdAfter && !isValidDate(createdAfter)) ||
			(createdBefore && !isValidDate(createdBefore)) ||
			(createdAfter && createdBefore && !isValidDateRange(createdAfter, createdBefore))) {
			return res.status(400).json({ error: "Invalid date range" });
		}
		// get all records
		const records = await fetchAllCryptoToFiatTransferRecord(profileId, userId, limit, createdAfter, createdBefore)
		return res.status(200).json(records)

	} catch (error) {
		console.error(error)
		await createLog("transfer/getAllCryptoToFiatTransfer", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}


}

exports.getCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}


	// if NODE_ENV is "development" then immediately return success with a message that says this endpoint is only available in production
	// if (process.env.NODE_ENV === "development") {
	// 	return res.status(200).json({ message: "This endpoint is only available in production" });
	// }

	const { id, profileId } = req.query

	try {
		if (!id || !isUUID(id)) return res.status(404).json({ error: `No transaction found for id: ${id}` })
		// get provider
		let { data: request, error: requestError } = await supabaseCall(() => supabase
			.from('offramp_transactions')
			.select('fiat_provider, crypto_provider')
			.eq("id", id)
			.maybeSingle())

		if (requestError) throw requestError
		if (!request) return res.status(404).json({ error: `No transaction found for id: ${id}` })

		const fetchFunc = FetchCryptoToBankSupportedPairCheck(request.crypto_provider, request.fiat_provider)
		let transactionRecord = await fetchFunc(id, profileId)
		if (!transactionRecord) return res.status(404).json({ error: `No transaction found for id: ${id}` })

		const externalDestinationAccountId = transactionRecord.transferDetails?.destinationAccountId;
		transactionRecord = await transferObjectReconstructor(transactionRecord, externalDestinationAccountId);

		return res.status(200).json(transactionRecord)

	} catch (error) {
		await createLog("transfer/getCryptoToFiatTransfer", null, error.message, error, profileId, res)
		return res.status(500).json({ error: `Unexpected error happened` })
	}

}

exports.createFiatToCryptoTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query
	const fields = req.body
	const { requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue } = fields


	try {
		const requiredFields = ["requestId", "sourceUserId", "destinationUserId", "amount", "sourceCurrency", "destinationCurrency", "chain", "sourceAccountId", "isInstant"]
		const acceptedFields = {
			"feeType": (value) => inStringEnum(value, ["FIX", "PERCENT"]),
			"feeValue": (value) => isValidAmount(value),
			"requestId": (value) => isUUID(value),
			"sourceUserId": (value) => isUUID(value),
			"destinationUserId": (value) => isUUID(value),
			"amount": (value) => isValidAmount(value),
			"sourceCurrency": (value) => inStringEnum(value, ["usd"]),
			"destinationCurrency": (value) => inStringEnum(value, ["usdc", "usdt", "usdHifi"]),
			"chain": (value) => isHIFISupportedChain(value),
			"sourceAccountId": (value) => isUUID(value),
			"isInstant": "boolean"
		}

		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })

		//check if sender is under profileId
		if (!(await verifyUser(sourceUserId, profileId))) return res.status(401).json({ error: "sourceUserId not found" })

		// check is request id valid
		if (!isUUID(requestId)) return res.status(400).json({ error: "invalid requestId" })
		// check is request id valid
		const { isAlreadyUsed, newRecord } = await checkIsFiatToCryptoRequestIdAlreadyUsed(requestId, sourceUserId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })
		const feeTransaction = await insertTransactionFeeRecord({ transaction_id: newRecord.id, transaction_type: transferType.FIAT_TO_CRYPTO, status: "CREATED" });

		// check fee config
		if (feeType || feeValue) {
			const { valid, error } = await canChargeFee(profileId, feeType, feeValue)
			if (!valid) return res.status(400).json({ error })
		}


		// look up the provider to get the actual internal account id
		const accountInfo = await fetchAccountProviders(sourceAccountId, profileId);
		if (!accountInfo || !accountInfo.account_id) return res.status(400).json({ error: `No provider found for id: ${sourceAccountId}` });
		const internalAccountId = accountInfo.account_id;
		fields.accountInfo = accountInfo

		// simulation in sandbox

		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && destinationCurrency == "usdHifi") {
			let transferResult = await sandboxMintUSDHIFI({ sourceAccountId, requestId, amount, sourceCurrency, destinationCurrency, chain, internalAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, accountInfo, feeTransactionId: feeTransaction.id })
			transferResult = await transferObjectReconstructor(transferResult, sourceAccountId);
			return res.status(200).json(transferResult);
		}

		//check is source-destination pair supported
		const transferFunc = FiatToCryptoSupportedPairFunctionsCheck(sourceCurrency, chain, destinationCurrency)
		if (!transferFunc) return res.status(400).json({ error: `Unsupported rail for ${sourceCurrency} to ${destinationCurrency} on ${chain}` });

		let transferResult = await transferFunc({ requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId: internalAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, accountInfo, feeTransactionId: feeTransaction.id })
		transferResult = await transferObjectReconstructor(transferResult, sourceAccountId);

		return res.status(200).json(transferResult);

	} catch (error) {
		console.log(error)
		if (error instanceof CreateFiatToCryptoTransferError) {
			if (error.type == CreateFiatToCryptoTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		await createLog("transfer/createFiatToCryptoTransfer", sourceUserId, error.message, error, null, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.getFiatToCryptoTransfer = async (req, res) => {

	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// if NODE_ENV is "development" then immediately return success with a message that says this endpoint is only available in production
	// if (process.env.NODE_ENV === "development") {
	// 	return res.status(200).json({ message: "This endpoint is only available in production" });
	// }

	const { id, profileId } = req.query

	if (!id || !isUUID(id)) return res.status(404).json({ error: `No transaction found for id: ${id}` })

	try {
		// get provider
		let { data: request, error: requestError } = await supabaseCall(() => supabase
			.from('onramp_transactions')
			.select('fiat_provider, crypto_provider')
			.eq("id", id)
			.maybeSingle())

		if (requestError) throw requestError
		if (!request) return res.status(404).json({ error: `No transaction found for id: ${id}` })
		const fetchFunc = FiatToCryptoSupportedPairFetchFunctionsCheck(request.crypto_provider, request.fiat_provider)
		let transactionRecord = await fetchFunc(id, profileId)

		if (!transactionRecord) return res.status(404).json({ error: `No transaction found for id: ${id}` })

		transactionRecord = await transferObjectReconstructor(transactionRecord);
		return res.status(200).json(transactionRecord)

	} catch (error) {
		await createLog("transfer/getCryptoToFiatTransfer", null, error.message, error, profileId, res)
		return res.status(500).json({ error: `Unexpected error happened` })
	}

}

exports.getAllFiatToCryptoTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const fields = req.query
	const { profileId, userId, virtualAccountId, limit, createdAfter, createdBefore } = fields
	const requiredFields = []
	const acceptedFields = {
		userId: (value) => isUUID(value),
		limit: (value) => isInRange(value, 1, 100),
		createdAfter: (value) => isValidDate(value),
		createdBefore: (value) => isValidDate(value),
		profileId: "string",
		virtualAccountId: (value) => isUUID(value)
	}

	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
		if (limit && !isValidLimit(limit)) return res.status(400).json({ error: "Invalid limit" })
		if ((createdAfter && !isValidDate(createdAfter)) ||
			(createdBefore && !isValidDate(createdBefore)) ||
			(createdAfter && createdBefore && !isValidDateRange(createdAfter, createdBefore))) {
			return res.status(400).json({ error: "Invalid date range" });
		}
		// should move to field validation
		if (virtualAccountId && !isUUID(virtualAccountId)) return res.status(400).json({ error: "Invalid virtualAccountId" })

		// get all records
		const records = await fetchAllFiatToCryptoTransferRecord(profileId, { userId, virtualAccountId }, limit, createdAfter, createdBefore)
		return res.status(200).json(records)

	} catch (error) {
		console.error(error)
		await createLog("transfer/getAllFiatToCryptoTransfer", userId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}


}

exports.cryptoToFiatConversionRate = async (req, res) => {
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

	const { fromCurrency, toCurrency, profileId } = req.query

	try {
		const requiredFields = ["fromCurrency", "toCurrency"]
		const acceptedFields = { fromCurrency: "string", toCurrency: "string" }
		const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: "Fields provided are either missing or invalid", missingFields, invalidFields })
		const func = getCryptoToFiatConversionRateFunction(fromCurrency, toCurrency)
		if (!func) return res.status(400).json({ error: `No available coversion rate from ${fromCurrency} to ${toCurrency}` })
		const conversionRate = await func(fromCurrency, toCurrency, profileId)
		if (!conversionRate) throw new Error("Failed to get coversion rate from provider")

		return res.status(200).json(conversionRate)
	} catch (error) {
		await createLog("transfer/cryptoToFiatConversionRate", null, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.createFiatToFiatViaCryptoTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const { profileId } = req.query;
	const { requestId, amount, sourceCurrency, destinationCurrency, sourceAccountId, destinationAccountId, sourceUserId, destinationUserId, feeType, feeValue } = fields;

	try {
		// Initiate the fiat to crypto transfer
		const fiatToCryptoResponse = await exports.createFiatToCryptoTransfer(req, res, true);
		if (fiatToCryptoResponse.status !== 200) {
			return res.status(fiatToCryptoResponse.status).json(fiatToCryptoResponse.body);
		}

		// Prepare the parameters needed for the offramp transaction
		const offrampParams = {
			requestId,
			destinationAccountId,
			amount, // Assume the same amount or calculate based on results from fiatToCryptoResponse
			chain: fiatToCryptoResponse.body.chainUsed, // Use the chain from fiat to crypto transaction if needed
			sourceCurrency: destinationCurrency, // Intermediate currency becomes the source
			destinationCurrency,
			sourceUserId,
			description: `Offramp for conversion from ${sourceCurrency} to ${destinationCurrency} via crypto`,
			purposeOfPayment: 'Fiat to Fiat transfer via crypto intermediary',
			feeType,
			feeValue,
			profileId
		};

		// Create a job to handle the offramp transaction after onramp is confirmed
		await createJob("handleOfframpForFiatToFiatViaCryptoTransfer", offrampParams, sourceUserId, profileId);

		return res.status(200).json({
			message: "Fiat to crypto initiated successfully. Offramp will proceed once onramp is confirmed.",
			fiatToCryptoResult: fiatToCryptoResponse.body
		});

	} catch (error) {
		console.error('Combined Transfer Error:', error);
		await createLog("transfer/createFiatToFiatViaCryptoTransfer", requestId, error.message, error, null, res);
		return res.status(500).json({ error: "Unexpected error happened", details: error.message });
	}
};

exports.createDirectCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const { profileId } = req.query;
	const { requestId, destinationAccountId, amount, chain, sourceCurrency, destinationCurrency, sourceWalletAddress, description, purposeOfPayment, feeType, feeValue, sameDayAch } = fields
	try {
		// filed validation
		const requiredFields = ["requestId", "destinationAccountId", "amount", "chain", "sourceCurrency", "destinationCurrency", "sourceWalletAddress"]
		const acceptedFields = {
			"feeType": "string", "feeValue": ["string", "number"], "sourceWalletAddress": "string",
			"requestId": "string", "sourceUserId": "string", "destinationUserId": "string", "destinationAccountId": "string", "amount": ["number", "string"], "chain": "string", "sourceCurrency": "string", "destinationCurrency": "string", "paymentRail": "string", "description": "string", "purposeOfPayment": "string", "sourceWalletType": "string", "same_day_ach": "boolean"
		}
		const { missingFields, invalidFields } = fieldsValidation({ ...fields }, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
		}
		// FIXME diable fee for now
		if (feeType || feeValue) return res.status(400).json({ error: "Fee collection in not available yet" })

		// check is request id valid
		if (!isUUID(requestId)) return res.status(400).json({ error: "invalid requestId" })

		const record = await checkIsCryptoToFiatRequestIdAlreadyUsed(requestId, profileId)
		if (record) return res.status(400).json({ error: `Request for requestId is already exists, please use get transaction endpoint with id: ${record.id}` })

		// FIX ME SHOULD put it in the field validation 
		if (!isNumberOrNumericString(amount)) return res.status(400).json({ error: "Invalid amount" })
		if (parseFloat(amount) < 1.01) return res.status(400).json({ error: "Amount should be at least $1.01" })

		// check if fee config is correct
		if (feeType || feeValue) {
			const { valid, error } = await canChargeFee(profileId, feeType, feeValue)
			if (!valid) return res.status(400).json({ error })
		}

		// check is chain supported
		if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Unsupported chain: ${chain}` });

		// get account info
		const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
		if (!accountInfo || !accountInfo.account_id) return res.status(400).json({ error: `destinationAccountId not exist` });
		if (accountInfo.rail_type != "offramp") return res.status(400).json({ error: `destinationAccountId is not a offramp bank account` });
		const paymentRail = accountInfo.payment_rail
		const internalAccountId = accountInfo.account_id

		//check is source-destination pair supported
		const funcs = CryptoToBankSupportedPairCheck(paymentRail, sourceCurrency, destinationCurrency)
		if (!funcs) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });
		const { directWithdrawFunc } = funcs
		if (!directWithdrawFunc) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });

		let { isExternalAccountExist, transferResult } = await directWithdrawFunc({ requestId, internalAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, paymentRail, sameDayAch })
		if (!isExternalAccountExist) return res.status(400).json({ error: `Invalid destinationAccountId or unsupported rail for provided destinationAccountId` });

		transferResult = await transferObjectReconstructor(transferResult, destinationAccountId);

		return res.status(200).json(transferResult);

	} catch (error) {
		if (error instanceof CreateCryptoToBankTransferError) {
			if (error.type == CreateCryptoToBankTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "An unexpected error occurred" })
			}
		}
		await createLog("transfer/createDirectCryptoToFiatTransfer", null, error.message, error, profileId, res)
		return res.status(500).json({ error: 'An unexpected error occurred' });
	}


}

exports.acceptQuoteTypeCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'PUT') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const { profileId, id } = req.query
	try {
		// get transaction id
		const record = await fetchCryptoToFiatRequestInfortmaionById(id, profileId)
		if (!record) return res.status(400).json({ error: `No quote found for id: ${id}` })
		// check if transaction is OPEN_QUOTE
		if (record.transaction_status != "OPEN_QUOTE") return res.status(200).json({ error: `Expired or invalid quote` })

		// get account Info
		const accountInfo = await fetchAccountProviders(record.destination_account_id, profileId)

		const funcs = CryptoToBankSupportedPairCheck(accountInfo.payment_rail, record.source_currency, record.destination_currency)

		if (!funcs) throw new Error(`No available functions found for id: ${id}`)
		const { acceptQuoteFunc } = funcs
		if (!funcs) return res.status(400).json({ error: `This is not a quote transaction, id: ${id}` })
		const transferResult = await acceptQuoteFunc({ recordId: id, profileId })
		const receipt = await transferObjectReconstructor(transferResult, record.destination_account_id);
		return res.status(200).json(receipt)

	} catch (error) {
		await createLog("transfer/acceptQuoteTypeCryptoToFiatTransfer", null, error.message, error, profileId, res)
		return res.status(500).json({ error: 'An unexpected error occurred' });
	}

}

exports.createFiatTotFiatTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query
	const fields = req.body
	const { requestId, accountNumber, routingNumber, recipientName, type, sourceUserId, sourceAccountId, amount, currency, memo } = fields


	try {
		const requiredFields = ["requestId", "accountNumber", "routingNumber", "recipientName", "type", "sourceUserId", "sourceAccountId", "amount", "currency"]
		const acceptedFields = {
			"requestId": (value) => isUUID(value),
			"accountNumber": "string",
			"routingNumber": "string",
			"recipientName": "string",
			"type": (value) => inStringEnum(value, ["CHECKING", "SAVINGS", "BUSINESS"]),
			"sourceUserId": (value) => isUUID(value),
			"sourceAccountId": (value) => isUUID(value),
			"amount": (value) => isValidAmount(value),
			"currency": (value) => inStringEnum(value, ["usd"]),
			"memo": "string",
		}
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })

		//check if sender is under profileId
		if (!(await verifyUser(sourceUserId, profileId))) return res.status(401).json({ error: "sourceUserId not found" })


		// check is request id valid
		const { isAlreadyUsed } = await checkIsFiatToFiatRequestIdAlreadyUsed(requestId);
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

		const accountInfo = await fetchAccountProviders(sourceAccountId, profileId);
		if (!accountInfo || !accountInfo.account_id || accountInfo.provider !== "CHECKBOOK") return res.status(400).json({ error: `No account found for sourceAccountId: ${sourceAccountId}` });

		const sourceCurrency = accountInfo.currency;
		const destinationCurrency = accountInfo.currency;

		const transferFunc = FiatToFiatSupportedPairFunctionsCheck(sourceCurrency, destinationCurrency);
		if (!transferFunc) return res.status(400).json({ error: `Unsupported rail for ${sourceCurrency} to ${destinationCurrency}` });

		let transferResult = await transferFunc({ requestId, accountNumber, routingNumber, recipientName, type, sourceUserId, sourceAccountId: accountInfo.account_id, amount, currency, memo, profileId });
		transferResult = await transferObjectReconstructor(transferResult, sourceAccountId);

		return res.status(200).json(transferResult);

	} catch (error) {
		if (error instanceof CreateFiatToFiatTransferError) {
			if (error.type == CreateFiatToFiatTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		await createLog("transfer/ach/pull", sourceUserId, error.message, error, null, res);
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.getTransfers = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, id, userId, limit, createdAfter, createdBefore, virtualAccountId, transferType } = req.query;
	try {
		if (id) {
			const requiredFields = ["id", "transferType"];
			const acceptedFields = { id: (value) => isUUID(value), transferType: (type) => isValidTransferType(type), profileId: "string" };

			const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields);
			if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });

			let fetchFunc, cryptoProvider, fiatProvider, transactionRecord;
			switch (transferType) {
				case TransferType["crypto-to-fiat"]:
					({ cryptoProvider, fiatProvider } = await fetchCryptoToFiatProvidersInformationById(id));
					if (!cryptoProvider || !fiatProvider) return res.status(404).json({ error: `No transaction found for id: ${id} for transfer type: ${transferType}` });
					fetchFunc = await FetchCryptoToBankSupportedPairCheck(cryptoProvider, fiatProvider);
					transactionRecord = await fetchFunc(id, profileId);
					transactionRecord = await transferObjectReconstructor(transactionRecord, transactionRecord.transferDetails?.destinationAccountId);
					break;
				case TransferType["fiat-to-crypto"]:
					({ cryptoProvider, fiatProvider } = await fetchFiatToCryptoProvidersInformationById(id));
					if (!cryptoProvider || !fiatProvider) return res.status(404).json({ error: `No transaction found for id: ${id} for transfer type: ${transferType}` });
					fetchFunc = await FiatToCryptoSupportedPairFetchFunctionsCheck(cryptoProvider, fiatProvider);
					transactionRecord = await fetchFunc(id, profileId);
					transactionRecord = await transferObjectReconstructor(transactionRecord);
					break;
				case TransferType["crypto-to-crypto"]:
					transactionRecord = await fetchCryptoToCryptoTransferRecord(id, profileId);
					break;
				case TransferType["fiat-to-fiat"]:
					({ fiatProvider, fiatReceiver } = await fetchFiatToFiatProvidersInformationById(id));
					if (!fiatProvider || !fiatReceiver) return res.status(404).json({ error: `No transaction found for id: ${id} for transfer type: ${transferType}` });
					fetchFunc = await FiatToFiatSupportedPairFetchFunctionsCheck(fiatProvider, fiatReceiver);
					transactionRecord = await fetchFunc(id, profileId);
					transactionRecord = await transferObjectReconstructor(transactionRecord);
					break;
				default:
					return res.status(400).json({ error: `Invalid transfer type: ${transferType}` });
			}

			if (!transactionRecord) return res.status(404).json({ error: `No transaction found for id: ${id} for transfer type: ${transferType}` })
			return res.status(200).json(transactionRecord);

		} else {
			const requiredFields = [];
			const acceptedFields = {
				userId: (value) => isUUID(value),
				limit: (value) => isInRange(value, 1, 100),
				createdAfter: (value) => isValidDate(value),
				createdBefore: (value) => isValidDate(value),
				profileId: "string",
				virtualAccountId: (value) => isUUID(value),
				transferType: (type) => isValidTransferType(type)
			};

			const { missingFields, invalidFields } = fieldsValidation(req.query, requiredFields, acceptedFields);
			// check if required fileds provided
			if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });
			if (createdAfter && createdBefore && !isValidDateRange(createdAfter, createdBefore)) return res.status(400).json({ error: "Invalid date range" });

			// if no transfer type provided, fetch all transfer records
			if (!transferType) {
				const c2fRecords = await fetchAllCryptoToFiatTransferRecord(profileId, userId, limit, createdAfter, createdBefore);
				const f2cRecords = await fetchAllFiatToCryptoTransferRecord(profileId, { userId, virtualAccountId }, limit, createdAfter, createdBefore);
				const c2cRecords = await fetchAllCryptoToCryptoTransferRecord(profileId, userId, limit, createdAfter, createdBefore);
				const allRecords = transferRecordsAggregator(limit, c2fRecords, f2cRecords, c2cRecords);
				return res.status(200).json(allRecords);
			}

			let records;
			switch (transferType) {
				case TransferType["crypto-to-fiat"]:
					records = await fetchAllCryptoToFiatTransferRecord(profileId, userId, limit, createdAfter, createdBefore);
					break;
				case TransferType["fiat-to-crypto"]:
					records = await fetchAllFiatToCryptoTransferRecord(profileId, { userId, virtualAccountId }, limit, createdAfter, createdBefore);
					break;
				case TransferType["crypto-to-crypto"]:
					records = await fetchAllCryptoToCryptoTransferRecord(profileId, userId, limit, createdAfter, createdBefore);
					break;
				default:
					return res.status(400).json({ error: `Invalid transfer type: ${transferType}` });
			}

			return res.status(200).json(records);

		}

	} catch (error) {
		await createLog("transfer/getTransfers", null, error.message, error, profileId, res)
		return res.status(500).json({ error: 'An unexpected error occurred' });
	}

}


// exports.createPfiDid = async (req, res) => {
// 	if (req.method !== 'POST') {
// 		return res.status(405).json({ error: 'Method not allowed' });
// 	}

// 	const { userId } = req.body;
// 	console.log('createPfiDid');
// 	const pfiDidId = "hifiSandboxPfi"

// 	const { DidDht } = await import('@web5/dids');
// 	const pfiDid = await DidDht.create({
// 		options: {
// 			publish: true,
// 			services: [{
// 				id: pfiDidId,
// 				type: 'PFI',
// 				serviceEndpoint: 'https://pfi-sandbox.hifibridge.com/'
// 			}]
// 		},
// 	})
// 	console.log('didDht:', pfiDid);

// 	const portableDid = await pfiDid.export()

// 	// save the record to supabase
// 	const { data, error } = await supabaseCall(() => supabase
// 		.from('tbd_decentralized_identifiers')
// 		.insert({
// 			user_id: userId,
// 			did: pfiDid.uri,
// 			portable_did: portableDid,
// 			did_dht: pfiDid,
// 		}
// 		)
// 		.single())

// 	if (error) {
// 		console.error('Error creating DID:', error);
// 		return res.status(500).json({ error: "An unexpected error occurred" });
// 	}


// 	console.log('portableDid:', portableDid);

// 	const did = pfiDid.uri;
// 	const didDocument = JSON.stringify(pfiDid.document);
// 	console.log('DID:', did);
// 	console.log('DID Document:', didDocument);


// 	return res.status(200).json({
// 		did: did,
// 		didDocument: didDocument

// 	});



// }


// exports.createExchangeTransfer = async (req, res) => {
// 	if (req.method !== 'POST') {
// 		return res.status(405).json({ error: 'Method not allowed' });

// 	}


// 	const { userId, sourceCurrency, destinationCurrency } = req.body

// 	// look up the did record for a given sourceUserId
// 	const { data: didRecord, error: didRecordError } = await supabaseCall(() => supabase
// 		.from('tbd_decentralized_identifiers')
// 		.select('*')
// 		.eq('user_id', userId)
// 		.maybeSingle())

// 	if (didRecordError || !didRecord) {
// 		console.error('Error fetching DID record:', didRecordError);
// 		return res.status(500).json({ error: "An unexpected error occurred" });
// 	}

// 	// console.log('didRecord:', didRecord);

// 	const { DidDht, BearerDid } = await import('@web5/dids');
// 	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');



// 	let matchedOfferings = [];

// 	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');

// 	const offerings = await TbdexHttpClient.getOfferings({ pfiDid: process.env.YC_PFI_DID });

// 	// if there are no offerings, return an error
// 	if (!offerings) {
// 		return res.status(500).json({ error: "An unexpected error occurred" });
// 	}

// 	// Define the specific offering ID to find
// 	const offeringId = 'offering_01j8thhe0pf6jaybgd00y7ht40';// KES in Sandbox PFI

// 	// Find the offering by ID directly from the offerings array
// 	const selectedOffering = offerings.find(offering => offering.metadata.id === offeringId);

// 	// if there is no offering with the specified ID, return an error
// 	if (!selectedOffering) {
// 		return res.status(500).json({ error: "An unexpected error occurred" });
// 	}


// 	const presentationDefinition = selectedOffering.data.requiredClaims;

// 	// construct the metadata object
// 	const metadata = {
// 		to: selectedOffering.metadata.from,
// 		from: didRecord.did,
// 		protocol: '1.0'
// 	}


// 	let ycRfq

// 	try {

// 		// Select the credentials to be used for the exchange
// 		const selectedCredentials = PresentationExchange.selectCredentials({
// 			vcJwts: ["eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDpkaHQ6aG8zYXhwNXBncDRrOGE3a3F0Yjhrbm41dWFxd3k5Z2hrbTk4d3J5dG5oNjdic243ZXpyeSMwIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvdmMvc3RhdHVzLWxpc3QvMjAyMS92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImlkIjoidXJuOnV1aWQ6YzMwZTYxOWItNGYyZC00OGY2LTkzMmQtMDlkNTRkODVmN2EyIiwiaXNzdWVyIjoiZGlkOmRodDpobzNheHA1cGdwNGs4YTdrcXRiOGtubjV1YXF3eTlnaGttOTh3cnl0bmg2N2JzbjdlenJ5IiwiaXNzdWFuY2VEYXRlIjoiMjAyNC0wOS0wNlQwNzo0ODowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpkaHQ6b244bzNyZWFkNnRrMWZ1ZWFkamVlM3IxOGJhbmI1dGozazh4YXRrZmpxMWc2cjllemR0byJ9fSwibmJmIjoxNzI1NjA4ODgzLCJqdGkiOiJ1cm46dXVpZDpjMzBlNjE5Yi00ZjJkLTQ4ZjYtOTMyZC0wOWQ1NGQ4NWY3YTIiLCJpc3MiOiJkaWQ6ZGh0OmhvM2F4cDVwZ3A0azhhN2txdGI4a25uNXVhcXd5OWdoa205OHdyeXRuaDY3YnNuN2V6cnkiLCJzdWIiOiJkaWQ6ZGh0Om9uOG8zcmVhZDZ0azFmdWVhZGplZTNyMThiYW5iNXRqM2s4eGF0a2ZqcTFnNnI5ZXpkdG8iLCJpYXQiOjE3MjU2MDg4ODN9.Cm-_3-TMmfRZFCVs0Xdt-YYTVwyBeYuR644_Ly4Svj3S5JmlrNGM4tT30G1hZRQl7po0WNsUNmYOEgX5sEItDQ"], // array of JWTs after YC actually issues the credentials
// 			presentationDefinition: presentationDefinition
// 		});


// 		// construct the data object
// 		const data = {
// 			offeringId: selectedOffering.metadata.id,
// 			payin: {
// 				kind: "USDC_LEDGER",
// 				amount: "10",
// 			},
// 			payout: {
// 				kind: 'MOMO_MPESA',
// 				paymentDetails: {
// 					accountNumber: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
// 					reason: 'Test payout',
// 					accountHolderName: 'Sam Yoon',

// 				}
// 			},
// 			claims: selectedCredentials
// 		};

// 		// create the rfq
// 		ycRfq = Rfq.create({
// 			metadata: metadata,
// 			data: data,
// 		});



// 	} catch (error) {
// 		console.error('Error creating RFQ:', error);
// 		return res.status(500).json({ error: error });
// 	}

// 	// console.log('rfq:', ycRfq);
// 	const bearerDid = await BearerDid.import({ portableDid: didRecord.portable_did });
// 	// console.log('rfq:', rfq);
// 	await ycRfq.sign(bearerDid);
// 	try {
// 		// create the exchange
// 		await TbdexHttpClient.createExchange(ycRfq);

// 	} catch (error) {
// 		//log details
// 		console.error("error details:", error);

// 		return res.status(500).json({ error: error });
// 	}

// 	//poll for quote
// 	let quote;
// 	let close;
// 	let exchange;
// 	//Wait for Quote message to appear in the exchange
// 	while (!quote) {
// 		try {
// 			exchange = await TbdexHttpClient.getExchange({
// 				pfiDid: ycRfq.metadata.to,
// 				did: bearerDid,
// 				exchangeId: ycRfq.exchangeId
// 			});

// 		} catch (error) {
// 			console.error('Error during getExchange:', error);
// 			return res.status(500).json({ error: error });
// 		}

// 		quote = exchange.find(msg => msg instanceof Quote);

// 		if (!quote) {
// 			// Make sure the exchange is still open
// 			close = exchange.find(msg => msg instanceof Close);
// 			if (close) { break; }
// 			else {
// 				// Wait 2 seconds before making another request
// 				await new Promise(resolve => setTimeout(resolve, 2000));
// 			}
// 		}
// 	}




// 	// create order object
// 	const order = Order.create({
// 		metadata: {
// 			from: didRecord.did,         // Customer's DID
// 			to: quote.metadata.from,       // PFI's DID
// 			exchangeId: quote.exchangeId,  // Exchange ID from the Quote
// 			protocol: "1.0"                // Version of tbDEX protocol you're using
// 		}
// 	});


// 	await order.sign(bearerDid);

// 	console.log('order:', order);
// 	try {
// 		await TbdexHttpClient.submitOrder(order);

// 	} catch (error) {
// 		console.error('Error submitting order:', error);
// 		return res.status(500).json({ error: error });
// 	}

// 	let orderStatusUpdate;
// 	let orderClose;

// 	while (!orderClose) {
// 		const exchange = await TbdexHttpClient.getExchange({
// 			pfiDid: order.metadata.to,
// 			did: bearerDid,
// 			exchangeId: order.exchangeId
// 		});

// 		for (const message of exchange) {
// 			if (message instanceof OrderStatus) {
// 				// a status update to display to your customer
// 				orderStatusUpdate = message.data.orderStatus;
// 			}
// 			else if (message instanceof Close) {
// 				// final message of exchange has been written
// 				orderClose = message;
// 				break;
// 			}
// 		}
// 	}

// 	console.log('orderClose:', orderClose);

// 	return res.status(200).json({
// 		quote: quote,
// 		closeMessage: orderClose
// 	});
// }



exports.createExchangeTransferTemp = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { userId } = req.body

	// look up the did record for a given sourceUserId
	const { data: didRecord, error: didRecordError } = await supabaseCall(() => supabase
		.from('tbd_decentralized_identifiers')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle())

	if (didRecordError || !didRecord) {
		console.error('Error fetching DID record:', didRecordError);
		return res.status(500).json({ error: "An unexpected error occurred" });
	}


	const { DidDht, BearerDid } = await import('@web5/dids');
	const { VerifiableCredential, PresentationExchange } = await import('@web5/credentials');


	const payinCurrencyCode = 'USDC';
	const payoutCurrencyCode = 'KES';
	let matchedOfferings = [];

	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');

	const ycDid = "did:dht:ho3axp5pgp4k8a7kqtb8knn5uaqwy9ghkm98wrytnh67bsn7ezry";
	const offerings = await TbdexHttpClient.getOfferings({ pfiDid: ycDid });

	if (offerings) {
		const filteredOfferings = offerings.filter(offering =>
			offering.data.payin.currencyCode === payinCurrencyCode &&
			offering.data.payout.currencyCode === payoutCurrencyCode
		);
		matchedOfferings.push(...filteredOfferings);
	}
	// const presentationDefinition = matchedOfferings[0].data.requiredClaims;

	// matchedOfferings.forEach(offering => {
	// 	console.log(JSON.stringify(offering, null, 2)); // `null` and `2` are for formatting purposes
	// });
	console.log('offerings:', JSON.stringify(matchedOfferings, null, 2));
	// loop through matched offerings where the offering.metada.id is == offering_01j60vgcygettvse30t5vxr6zt
	// const selectedOffering = matchedOfferings.find(offering => offering.metadata.id === 'offering_01j60vgcygettvse30t5vxr6zt');
	const selectedOffering = matchedOfferings.find(offering => offering.metadata.id === 'offering_01j9bgxk9pf2asxdy0yjf5bja3');

	console.log('selectedOffering', selectedOffering)
	// console.log('selectedOffering.data.requiredClaims:', JSON.stringify(selectedOffering.data.requiredClaims, null, 2));


	const presentationDefinition = selectedOffering.data.requiredClaims;
	console.log('presentationDefinition:', JSON.stringify(presentationDefinition, null, 2));
	// construct the metadata object
	const metadata = {
		to: selectedOffering.metadata.from,
		from: didRecord.did,
		protocol: '1.0'
	}

	console.log('metadata:', metadata);


	let ycRfq

	try {

		// Select the credentials to be used for the exchange
		const selectedCredentials = PresentationExchange.selectCredentials({
			vcJwts: ["eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDpkaHQ6aG8zYXhwNXBncDRrOGE3a3F0Yjhrbm41dWFxd3k5Z2hrbTk4d3J5dG5oNjdic243ZXpyeSMwIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvdmMvc3RhdHVzLWxpc3QvMjAyMS92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImlkIjoidXJuOnV1aWQ6YzMwZTYxOWItNGYyZC00OGY2LTkzMmQtMDlkNTRkODVmN2EyIiwiaXNzdWVyIjoiZGlkOmRodDpobzNheHA1cGdwNGs4YTdrcXRiOGtubjV1YXF3eTlnaGttOTh3cnl0bmg2N2JzbjdlenJ5IiwiaXNzdWFuY2VEYXRlIjoiMjAyNC0wOS0wNlQwNzo0ODowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpkaHQ6b244bzNyZWFkNnRrMWZ1ZWFkamVlM3IxOGJhbmI1dGozazh4YXRrZmpxMWc2cjllemR0byJ9fSwibmJmIjoxNzI1NjA4ODgzLCJqdGkiOiJ1cm46dXVpZDpjMzBlNjE5Yi00ZjJkLTQ4ZjYtOTMyZC0wOWQ1NGQ4NWY3YTIiLCJpc3MiOiJkaWQ6ZGh0OmhvM2F4cDVwZ3A0azhhN2txdGI4a25uNXVhcXd5OWdoa205OHdyeXRuaDY3YnNuN2V6cnkiLCJzdWIiOiJkaWQ6ZGh0Om9uOG8zcmVhZDZ0azFmdWVhZGplZTNyMThiYW5iNXRqM2s4eGF0a2ZqcTFnNnI5ZXpkdG8iLCJpYXQiOjE3MjU2MDg4ODN9.Cm-_3-TMmfRZFCVs0Xdt-YYTVwyBeYuR644_Ly4Svj3S5JmlrNGM4tT30G1hZRQl7po0WNsUNmYOEgX5sEItDQ"], // array of JWTs after YC actually issues the credentials
			presentationDefinition: presentationDefinition
		});

		console.log('selectedCredentials:', selectedCredentials);

		// construct the data object
		const data = {
			offeringId: selectedOffering.metadata.id,
			payin: {
				kind: "USDC_LEDGER",
				amount: "10",
			},
			payout: {
				kind: 'MOMO_MPESA',
				paymentDetails: {
					accountNumber: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
					reason: 'Test payout',
					accountHolderName: 'Sam Yoon',

				}
			},
			claims: selectedCredentials
		};

		// create the rfq
		ycRfq = Rfq.create({
			metadata: metadata,
			data: data,
		});



	} catch (error) {
		console.error('Error creating RFQ:', error);
		return res.status(500).json({ error: error });
	}

	// console.log('rfq:', ycRfq);
	const bearerDid = await BearerDid.import({ portableDid: didRecord.portable_did });
	// console.log('rfq:', rfq);
	await ycRfq.sign(bearerDid);
	try {
		// create the exchange
		await TbdexHttpClient.createExchange(ycRfq);

	} catch (error) {
		console.error('Error creating exchange:', error);
		//log details
		console.error("error details:", error.details);

		return res.status(500).json({ error: error });
	}

	//poll for quote
	let quote;
	let close;
	let exchange;
	console.log("ycRfq.exchangeId", ycRfq.exchangeId);
	//Wait for Quote message to appear in the exchange
	while (!quote) {
		try {
			exchange = await TbdexHttpClient.getExchange({
				pfiDid: ycRfq.metadata.to,
				did: bearerDid,
				exchangeId: ycRfq.exchangeId
			});

		} catch (error) {
			console.error('Error during getExchange:', error);
			return res.status(500).json({ error: error });
		}

		quote = exchange.find(msg => msg instanceof Quote);
		console.log('************found quote:', quote);

		if (!quote) {
			// Make sure the exchange is still open
			close = exchange.find(msg => msg instanceof Close);
			console.log('************found close:', close);
			if (close) { break; }
			else {
				// Wait 2 seconds before making another request
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	}

	console.log('quote:', quote);



	// create order object
	const order = Order.create({
		metadata: {
			from: didRecord.did,         // Customer's DID
			to: quote.metadata.from,       // PFI's DID
			exchangeId: quote.exchangeId,  // Exchange ID from the Quote
			protocol: "1.0"                // Version of tbDEX protocol you're using
		}
	});


	await order.sign(bearerDid);

	console.log('order:', order);
	try {
		await TbdexHttpClient.submitOrder(order);

	} catch (error) {
		console.error('Error submitting order:', error);
		return res.status(500).json({ error: error });
	}

	let orderStatusUpdate;
	let orderClose;

	while (!orderClose) {
		const exchange = await TbdexHttpClient.getExchange({
			pfiDid: order.metadata.to,
			did: bearerDid,
			exchangeId: order.exchangeId
		});

		for (const message of exchange) {
			if (message instanceof OrderStatus) {
				// a status update to display to your customer
				orderStatusUpdate = message.data.orderStatus;
			}
			else if (message instanceof Close) {
				// final message of exchange has been written
				orderClose = message;
				break;
			}
		}
	}

	console.log('orderClose:', orderClose);

	return res.status(200).json({
		quote: quote,
		closeMessage: orderClose
	});
}
exports.createBridgingRequest = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId } = req.query
	const fields = req.body
	fields.profileId = profileId
	const { sourceUserId, destinationUserId, requestId, sourceWalletType, destinationWalletType, sourceChain, destinationChain } = fields

	try {
		const requiredFields = ["sourceUserId", "destinationUserId", "amount", "sourceChain", "destinationChain", "requestId", "currency"]
		const acceptedFields = {
			"sourceUserId": (value) => isUUID(value),
			"destinationUserId": (value) => isUUID(value),
			"amount": (value) => isValidAmount(value),
			"sourceChain": (value) => isHIFISupportedChain(value),
			"destinationChain": (value) => isHIFISupportedChain(value),
			"requestId": (value) => isUUID(value),
			"currency": (value) => inStringEnum(value, ["usdc"]),
			"sourceWalletType": (value) => inStringEnum(value, ["INDIVIDUAL", "FEE_COLLECTION", "PREFUNDED"]),
			"destinationWalletType": (value) => inStringEnum(value, ["INDIVIDUAL", "FEE_COLLECTION", "PREFUNDED"]),
		}

		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields);
		if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields });

		// check if sourceUserId and destinationUserId are under profileId
		if (!(await verifyUser(sourceUserId, profileId))) return res.status(401).json({ error: "sourceUserId not found" })
		if (!(await verifyUser(destinationUserId, profileId))) return res.status(401).json({ error: "destinationUserId not found" })
		if (!sourceWalletType) fields.sourceWalletType = "INDIVIDUAL"
		if (!destinationWalletType) fields.destinationWalletType = "INDIVIDUAL"

		// check if source wallet is kyc passed
		const { bastionUserId: sourceBastionUserId } = await getBastionWallet(sourceUserId, sourceChain, fields.sourceWalletType)
		if (!(await isBastionKycPassed(sourceBastionUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })

		// check if destination wallet is kyc passed
		const { bastionUserId: destinationBastionUserId } = await getBastionWallet(destinationUserId, destinationChain, fields.destinationWalletType)
		if (!(await isBastionKycPassed(destinationBastionUserId))) return res.status(400).json({ error: `User is not allowed to receive crypto (user status invalid)` })

		// check if requestId is already used
		const { isAlreadyUsed } = await checkIsBridgingRequestIdAlreadyUsed(requestId, profileId);
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

		// TODO: create function map for different currency
		// right now only usdc bridging is supported
		const result = await createUsdcBridgingRequest(fields);
		return res.status(200).json(result);
	} catch (error) {
		await createLog("transfer/createBridgingRequest", sourceUserId, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.getBridgingTransactions = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { profileId, id } = req.query

	try {
		// TODO: create function map for different currency
		// right now only usdc bridging is supported
		const receipt = await fetchBridgingTransactions(id, profileId)
		return res.status(200).json(receipt)

	} catch (error) {
		await createLog("transfer/getBridgingTransactions", null, error.message, error, profileId, res)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}