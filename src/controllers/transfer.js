const supabase = require("../util/supabaseClient");
const { fieldsValidation, isUUID } = require("../util/common/fieldsValidation");
const { isValidLimit, isValidDateRange, isValidDate } = require("../util/common/transferValidation");
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
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../util/transfer/fiatToCrypto/utils/utils");
const { checkIsCryptoToFiatRequestIdAlreadyUsed, fetchCryptoToFiatRequestInfortmaionById } = require("../util/transfer/cryptoToBankAccount/utils/fetchRequestInformation");
const { checkIsFiatToCryptoRequestIdAlreadyUsed, checkIsFiatToFiatRequestIdAlreadyUsed } = require("../util/transfer/fiatToCrypto/utils/fetchRequestInformation");
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
const { transferObjectReconstructor } = require("../util/transfer/utils/transfer");
const { isInRange, isValidAmount, isHIFISupportedChain, inStringEnum } = require("../util/common/filedValidationCheckFunctions");
const { createSandboxCryptoToFiatTransfer } = require("../util/transfer/cryptoToBankAccount/transfer/sandboxCryptoToFiatTransfer");
const sandboxMintUSDHIFI = require("../util/transfer/fiatToCrypto/transfer/sandboxMintUSDHIFI");
const { createBastionSandboxCryptoTransfer } = require("../util/transfer/cryptoToCrypto/main/bastionTransfeSandboxUSDHIFI");
const { account } = require(".");


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
		const { isAlreadyUsed } = await checkIsCryptoToCryptoRequestIdAlreadyUsed(requestId, senderUserId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

		// fetch sender wallet address information
		if (senderWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
		if (senderWalletType && !allowedWalletTypes.includes(senderWalletType)) return res.status(400).json({ error: `wallet type ${senderWalletType} is not supported` })
		const _senderWalletType = senderWalletType || "INDIVIDUAL"
		const { walletAddress: senderAddress, bastionUserId: senderBastionUserId } = await getBastionWallet(senderUserId, chain, _senderWalletType)
		if (!senderAddress || !senderBastionUserId) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })
		fields.senderAddress = senderAddress
		fields.senderBastionUserId = senderBastionUserId
		// check privilege
		if (!(await isBastionKycPassed(senderUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })

		// check recipient wallet address if using recipientUserId
		if (recipientUserId) {
			if (recipientWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
			if (recipientWalletType && !allowedWalletTypes.includes(recipientWalletType)) return res.status(400).json({ error: `wallet type ${recipientWalletType} is not supported` })
			const _recipientWalletType = recipientWalletType || "INDIVIDUAL"
			const { walletAddress: recipientAddress, bastionUserId: recipientBastionUserId } = await getBastionWallet(recipientUserId, chain, _recipientWalletType)
			if (!recipientAddress || !recipientBastionUserId) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })
			fields.recipientAddress = recipientAddress
			fields.recipientBastionUserId = recipientBastionUserId
			if (!(await isBastionKycPassed(recipientUserId))) return res.status(400).json({ error: `User is not allowed to accept crypto` })
		}


		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && currency == "usdHifi"){
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
		await createLog("transfer/createCryptoToCryptoTransfer", senderUserId, error.message, error)
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
		await createLog("transfer/getAllCryptoToCryptoTransfer", userId, error.message, error, profileId)
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
		await createLog("transfer/getCryptoToCryptoTransfer", null, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.createCryptoToFiatTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const { profileId } = req.query
	let { requestId, destinationAccountId, amount, chain, sourceCurrency, destinationCurrency, sourceUserId, description, purposeOfPayment, feeType, feeValue, sourceWalletType, sameDayAch, receivedAmount, achReference, sepaReference, wireMessage, swiftReference } = fields

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
			"sourceCurrency": "string",
			"destinationCurrency": "string",
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
		// check is request id valid
		if (!isUUID(requestId)) return res.status(400).json({ error: "invalid requestId" })

		const { isAlreadyUsed } = await checkIsCryptoToFiatRequestIdAlreadyUsed(requestId, profileId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

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
		if (!accountInfo || !accountInfo.account_id) return res.status(400).json({ error: `destinationAccountId not exist` });
		if (accountInfo.rail_type != "offramp") return res.status(400).json({ error: `destinationAccountId is not a offramp bank account` });
		if (accountInfo.currency != destinationCurrency) return res.status(400).json({ error: `destinationCurrency not allowed for destinationAccountId` });
		let paymentRail = accountInfo.payment_rail
		const destinationUserId = accountInfo.user_id

		// if accountInfo.paymentRail is "ach" and the "sameDayAch" is true, then set the paymentRail to "sameDayAch"
		// refactor the below to return a 400 error if sameDayAch is true, but payment_rail is not "ach"
		if (accountInfo.payment_rail == "ach" && sameDayAch) {
			paymentRail = "sameDayAch"
		} else if (sameDayAch && !accountInfo.payment_rail == "ach") {
			return res.status(400).json({ error: `sameDayAch is only available for ACH transfers, but the destinationAccountId passed was not for an ACH account.` })
		}

		// get user wallet
		// fetch sender wallet address information
		if (sourceWalletType == "") return res.status(400).json({ error: `wallet type can not be empty string` })
		if (sourceWalletType && !allowedWalletTypes.includes(sourceWalletType)) return res.status(400).json({ error: `wallet type ${sourceWalletType} is not supported` })
		const _sourceWalletType = sourceWalletType || "INDIVIDUAL"
		const { walletAddress: sourceWalletAddress, bastionUserId: sourceBastionUserId } = await getBastionWallet(sourceUserId, chain, _sourceWalletType)
		if (!sourceWalletAddress || !sourceBastionUserId) {
			return res.status(400).json({ error: `No user wallet found for chain: ${chain}` })
		}
		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && sourceCurrency == "usdHifi") {
			const { isExternalAccountExist, transferResult } = await createSandboxCryptoToFiatTransfer({ requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, paymentRail, sourceBastionUserId, sourceWalletType: _sourceWalletType, destinationUserId, description, purposeOfPayment, receivedAmount, achReference, sepaReference, wireMessage, swiftReference })
			if (!isExternalAccountExist) return res.status(400).json({ error: `Invalid destinationAccountId or unsupported rail for provided destinationAccountId` });
			const receipt = await transferObjectReconstructor(transferResult, destinationAccountId);
			return res.status(200).json(receipt);
		}

		//check is source-destination pair supported
		const funcs = CryptoToBankSupportedPairCheck(paymentRail, sourceCurrency, destinationCurrency)
		if (!funcs) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });
		const { transferFunc } = funcs
		if (!transferFunc) return res.status(400).json({ error: `${paymentRail}: ${sourceCurrency} to ${destinationCurrency} is not a supported rail` });


		const { isExternalAccountExist, transferResult } = await transferFunc({ requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, paymentRail, sourceBastionUserId, sourceWalletType: _sourceWalletType, destinationUserId, description, purposeOfPayment, receivedAmount, achReference, sepaReference, wireMessage, swiftReference })
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
		await createLog("transfer/crypto-to-fiat", sourceUserId, error.message, error)
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
		await createLog("transfer/getAllCryptoToFiatTransfer", userId, error.message, error, profileId)
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
		await createLog("transfer/getCryptoToFiatTransfer", null, error.message, error, profileId)
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
			"sourceCurrency": "string",
			"destinationCurrency": "string",
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
		const { isAlreadyUsed } = await checkIsFiatToCryptoRequestIdAlreadyUsed(requestId, sourceUserId)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })

		// check fee config
		if (feeType || feeValue) {
			const { valid, error } = await canChargeFee(profileId, feeType, feeValue)
			if (!valid) return res.status(400).json({ error })
		}


		// look up the provider to get the actual internal account id
		const providerResult = await fetchAccountProviders(sourceAccountId, profileId);
		if (!providerResult || !providerResult.account_id) return res.status(400).json({ error: `No provider found for id: ${sourceAccountId}` });
		const internalAccountId = providerResult.account_id;

		// simulation in sandbox

		if (process.env.NODE_ENV == "development" && (chain == Chain.POLYGON_AMOY || chain == Chain.ETHEREUM_TESTNET) && destinationCurrency == "usdHifi"){
			let transferResult = await sandboxMintUSDHIFI({ sourceAccountId, requestId, amount, sourceCurrency, destinationCurrency, chain, internalAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId})
			transferResult = await transferObjectReconstructor(transferResult, sourceAccountId);
			return res.status(200).json(transferResult);
		}

		//check is source-destination pair supported
		const transferFunc = FiatToCryptoSupportedPairFunctionsCheck(sourceCurrency, chain, destinationCurrency)
		if (!transferFunc) return res.status(400).json({ error: `Unsupported rail for ${sourceCurrency} to ${destinationCurrency} on ${chain}` });

		let transferResult = await transferFunc(requestId, amount, sourceCurrency, destinationCurrency, chain, internalAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId)
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
		await createLog("transfer/createFiatToCryptoTransfer", sourceUserId, error.message, error)
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
		await createLog("transfer/getCryptoToFiatTransfer", null, error.message, error, profileId)
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
		await createLog("transfer/getAllFiatToCryptoTransfer", userId, error.message, error, profileId)
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
		await createLog("transfer/cryptoToFiatConversionRate", null, error.message, error, profileId)
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
		await createLog("transfer/createFiatToFiatViaCryptoTransfer", requestId, error.message, error);
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
		await createLog("transfer/createDirectCryptoToFiatTransfer", null, error.message, error, profileId)
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
		await createLog("transfer/acceptQuoteTypeCryptoToFiatTransfer", null, error.message, error, profileId)
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
		const { isAlreadyUsed } = await checkIsFiatToFiatRequestIdAlreadyUsed(requestId, sourceUserId, accountNumber, routingNumber, recipientName, type, sourceAccountId, amount, currency, memo)
		if (isAlreadyUsed) return res.status(400).json({ error: `Invalid requestId, resource already used` })
		// get the plaid connected bank account from supabase

		const accountInfo = await fetchAccountProviders(sourceAccountId, profileId)



		// get the checkbook account representing checkbook account from supabase
		const { data: checkbookAccount, error: checkbookAccountError } = await supabaseCall(() => supabase

			.from('checkbook_accounts')
			.select('*')
			.eq('id', accountInfo.account_id)
			.maybeSingle()
		);

		if (checkbookAccountError) throw checkbookAccountError;
		if (!checkbookAccount) throw new Error('Checkbook account not found');


		// get the checkbook user for the account from supabase
		const { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
			.from('checkbook_users')
			.select('*')
			.eq('checkbook_user_id', checkbookAccount.checkbook_user_id)
			.maybeSingle()
		);

		if (checkbookUserError) throw checkbookUserError;
		if (!checkbookUser) throw new Error('Checkbook user not found');

		// execute checkbook payment
		const createDigitalPaymentUrl = `${process.env.CHECKBOOK_URL}/check/direct`;
		const body = {
			"recipient": `${checkbookUser.user_id}@hifibridge.com`,
			"account_type": type,
			"routing_number": routingNumber,
			"account_number": accountNumber,
			"name": recipientName,
			"amount": amount,
			"account": checkbookAccount.checkbook_id,
			"description": memo,
		}

		const options = {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUser.api_key}:${checkbookUser.api_secret}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		};

		const response = await fetch(createDigitalPaymentUrl, options);
		const responseBody = await response.json()

		if (!response.ok) {
			const { data, error } = await supabase
				.from("fiat_to_fiat_transactions")
				.update({
					checkbook_response: responseBody,
					status: "SUBMISSION_FAILED"
				})
				.eq("id", requestId)
			await createLog("transfer/ach/pull", sourceUserId, responseBody.message, responseBody)
			throw new Error(responseBody.message)
		}
		const toUpdate = {
			checkbook_response: responseBody,
			status: "FIAT_SUBMITTED",
			checkbook_payment_id: responseBody.id,
			checkbook_status: responseBody.status
		}

		if (process.env.NODE_ENV === "development") {
			toUpdate.status = "CONFIRMED"
			toUpdate.checkbook_status = "PAID"
		}

		// update record
		const { data: updatedRecord, error: updatedRecordError } = await supabaseCall(() => supabase
			.from("fiat_to_fiat_transactions")
			.update(toUpdate)
			.eq("request_id", requestId)
			.select()
			.single())

		if (updatedRecordError) {
			await createLog("transfer/ach/pull", sourceUserId, updatedRecordError.message, updatedRecordError)
			throw new Error(updatedRecordError.message)
		}

		let responseObject = {
			id: updatedRecord.id,
			requestId: updatedRecord.request_id,
			createdAt: updatedRecord.created_at,
			recipientName: updatedRecord.recipient_name,
			status: updatedRecord.status,
			amount: updatedRecord.amount,
			currency: updatedRecord.currency,
			sourceAccountId: updatedRecord.source_account_id,
		}

		return res.status(200).json(responseObject);

	} catch (error) {
		console.log(error)
		if (error instanceof CreateFiatToCryptoTransferError) {
			if (error.type == CreateFiatToCryptoTransferErrorType.CLIENT_ERROR) {
				return res.status(400).json({ error: error.message })
			} else {
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		await createLog("transfer/ach/pull", sourceUserId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}
