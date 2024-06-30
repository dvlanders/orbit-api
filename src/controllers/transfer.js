const supabase = require("../util/supabaseClient");
const { fieldsValidation, isUUID } = require("../util/common/fieldsValidation");
const { requiredFields, acceptedFields, supportedCurrency } = require("../util/transfer/cryptoToCrypto/utils/createTransfer");
const createLog = require("../util/logger/supabaseLogger");
const { hifiSupportedChain, currencyDecimal, Chain } = require("../util/common/blockchain");
const { isBastionKycPassed, isBridgeKycPassed } = require("../util/common/privilegeCheck");
const { checkIsCryptoToCryptoRequestIdAlreadyUsed } = require("../util/transfer/cryptoToCrypto/utils/fetchRequestInformation");
const { transfer, CreateCryptoToCryptoTransferErrorType, CreateCryptoToCryptoTransferError } = require("../util/transfer/cryptoToCrypto/main/bastionTransfer");
const { fetchUserWalletInformation } = require("../util/transfer/cryptoToCrypto/utils/fetchUserWalletInformation");
const fetch = require('node-fetch');
// const { fieldsValidation } = require("../util/common/fieldsValidation");
const { supabaseCall } = require('../util/supabaseWithRetry');
const { v4 } = require('uuid');
const { verifyUser } = require("../util/helper/verifyUser");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../util/transfer/cryptoToBankAccount/utils/createTransfer");
const FiatToCryptoSupportedPairFunctions = require("../util/transfer/fiatToCrypto/utils/fiatToCryptoSupportedPairFunctions");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../util/transfer/fiatToCrypto/utils/utils");
const { checkIsCryptoToFiatRequestIdAlreadyUsed } = require("../util/transfer/cryptoToBankAccount/utils/fetchRequestInformation");
const { checkIsFiatToCryptoRequestIdAlreadyUsed} = require("../util/transfer/fiatToCrypto/utils/fetchRequestInformation");
const fetchFiatToCryptoTransferRecord = require("../util/transfer/fiatToCrypto/transfer/fetchTransferRecord");
const fetchCryptoToCryptoTransferRecord = require("../util/transfer/cryptoToCrypto/main/fetchTransferRecord");
const cryptoToCryptoSupportedFunctions = require("../util/transfer/cryptoToCrypto/utils/cryptoToCryptoSupportedFunctions");
const CryptoToBankSupportedPairCheck = require("../util/transfer/cryptoToBankAccount/utils/cryptoToBankSupportedPairFunctions");
const FetchCryptoToBankSupportedPairCheck = require("../util/transfer/cryptoToBankAccount/utils/cryptoToBankSupportedPairFetchFunctions");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

exports.createCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// should gather senderUserId, profileId, amount, requestId, recipientUserId, recipientAddress, chain
	const {profileId} = req.query
	const fields = req.body
	const { senderUserId, amount, requestId, recipientUserId, recipientAddress, chain, currency } = fields
	try {
		const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)

		// check if required fileds provided
		if (missingFields.length > 0 || invalidFields.length > 0) {
			return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
		}
		//check if sender is under profileId
		if (! (await verifyUser(senderUserId, profileId))) return res.status(401).json({error: "Not authorized"})
		// check if provide either recipientUserId or recipientAddress
		if (!recipientUserId && !recipientAddress) return res.status(400).json({ error: `Should provide either recipientUserId or recipientAddress` })
		if (recipientUserId && recipientAddress) return res.status(400).json({ error: `Should only provide either recipientUserId or recipientAddress` })
		// check if chain is supported
		if (!(chain in cryptoToCryptoSupportedFunctions)) return res.status(400).json({ error: `Chain ${chain} is not supported` })
		// check if currency is supported
		if (!(currency in cryptoToCryptoSupportedFunctions[chain])) return res.status(400).json({ error: `Currency ${currency} is not supported` })
		// check is request_id exist
		const record = await checkIsCryptoToCryptoRequestIdAlreadyUsed(requestId, senderUserId)
		if (record) return res.status(400).json({ error: `Request for requestId is already exist, please use get transaction endpoint with id: ${record.id}` })
		// get transfer function
		const { transferFunc, walletProviderTable } = cryptoToCryptoSupportedFunctions[chain][currency]
		// fetch sender wallet address information
		const senderWalletInformation = await fetchUserWalletInformation(senderUserId, chain, walletProviderTable)
		if (!senderWalletInformation) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user wallet record not found)` })

		// check privilege
		if (!(await isBastionKycPassed(senderUserId)) || !(await isBridgeKycPassed(senderUserId))) return res.status(400).json({ error: `User is not allowed to trasnfer crypto (user status invalid)` })

		// check recipient wallet address if using recipientUserId
		if (recipientUserId) {
			const recipientWalletInformation = await fetchUserWalletInformation(recipientUserId, chain, walletProviderTable)
			if (!recipientWalletInformation) return res.status(400).json({ error: `recipient wallet not found` })
			fields.recipientAddress = recipientWalletInformation.address
		}
		// transfer
		const receipt = await transferFunc(fields)

		return res.status(200).json(receipt)
	} catch (error) {
		if (error instanceof CreateCryptoToCryptoTransferError){
			if (error.type == CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR){
				return res.status(400).json({ error: error.message })
			}else{
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		createLog("transfer/create", senderUserId, error.message, error)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}

exports.getCryptoToCryptoTransfer = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { id } = req.query

	try {
		// check if requestRecord exist
		const transactionRecord = await fetchCryptoToCryptoTransferRecord(id)
		if (!transactionRecord) return res.status(404).json({ error: `No transaction found for id: ${id}`})
		return res.status(200).json(transactionRecord)

	} catch (error) {
		createLog("transfer/getCryptoToCryptoTransfer", null, error.message)
		return res.status(500).json({ error: "Unexpected error happened" })
	}

}

exports.transferCryptoFromWalletToBankAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const fields = req.body;
	const {profileId} = req.query
	const { requestId, destinationAccountId, amount, chain, sourceCurrency, destinationCurrency, sourceUserId, destinationUserId, paymentRail, description, purposeOfPayment } = fields
	try{
	// filed validation
	const requiredFields = ["requestId", "sourceUserId", "destinationUserId","destinationAccountId", "amount", "chain", "sourceCurrency", "destinationCurrency", "paymentRail"]
	const acceptedFields = {
		"requestId": "string", "sourceUserId": "string", "destinationUserId": "string","destinationAccountId": "string", "amount": "number", "chain": "string", "sourceCurrency": "string", "destinationCurrency": "string", "paymentRail": "string"
	}
	const { missingFields, invalidFields } = fieldsValidation({...fields}, requiredFields, acceptedFields)
	if (missingFields.length > 0 || invalidFields.length > 0) {
		return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
	}
	// check is request id valid
	if (!isUUID(requestId)) return res.status(400).json({error: "invalid requestId"})
	const record = await checkIsCryptoToFiatRequestIdAlreadyUsed(requestId, sourceUserId)
	if (record) return res.status(400).json({ error: `Request for requestId is already exist, please use get transaction endpoint with id: ${record.id}` }) 
	// check if authorized
	if (! (await verifyUser(sourceUserId, profileId))) return res.status(401).json({error: "Not authorized"})

	// check is chain supported
	if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Unsupported chain: ${chain}` }); 

	//check is source-destination pair supported
	const funcs = CryptoToBankSupportedPairCheck(paymentRail, sourceCurrency, destinationCurrency)
	if (!funcs) return res.status(400).json({ error: `Unsupported rail for ${paymentRail}: ${sourceCurrency} to ${destinationCurrency}` }); 

	// get the wallet record
	const { data: walletData, error: walletError } = await supabase
		.from('bastion_wallets')
		.select('address')
		.eq('user_id', sourceUserId)
		.eq('chain', chain)
		.maybeSingle();

	if (walletError) {
		return res.status(400).json({ error: 'An error occurred while fetching the wallet record' });
	}
	if (!walletData){
		return res.status(400).json({error: `No user wallet found for chain: ${chain}`})
	}

	const { transferFunc } = funcs
	const {isExternalAccountExist, transferResult} = await transferFunc(requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, walletData.address)
	if (!isExternalAccountExist) return res.status(400).json({ error: `Invalid destinationAccountId or unsupported rail for provided destinationAccountId` });
	return res.status(200).json(transferResult);

	} catch (error) {
		if (error instanceof CreateCryptoToBankTransferError){
			if (error.type == CreateCryptoToBankTransferErrorType.CLIENT_ERROR){
				return res.status(400).json({ error: error.message })
			}else{
				return res.status(500).json({ error: "Unexpected error happened" })
			}
		}
		createLog("transfer/crypto-to-fiat", sourceUserId, error.message)
		return res.status(500).json({ error: 'Unexpected error happened' });
	}

}

exports.getCryptoToFiatTransfer = async(req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { id } = req.query
	if (!id) return res.status(400).json({error: `id is required`})
	try{

		// get provider
		let { data: request, error:requestError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.select('fiat_provider, crypto_provider')
		.eq("id", id)
		.maybeSingle())
	
		if (requestError) throw requestError
		if (!request) return res.status(404).json({error: `No transaction found for id: ${id}`})

		const fetchFunc = FetchCryptoToBankSupportedPairCheck(request.crypto_provider, request.fiat_provider)
		const transactionRecord = await fetchFunc(id)
		return res.status(200).json(transactionRecord)

	}catch (error){
		createLog("transfer/getCryptoToFiatTransfer", null, error.message)
		return res.status(500).json({error: `Unexpected error happened`})
	}

}

exports.createFiatToCryptoTransfer = async(req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const {profileId} = req.query
	const fields = req.body
	console.log(fields)
	const {requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId} = fields
	try {
		const requiredFields = ["requestId", "sourceUserId", "destinationUserId", "amount", "sourceCurrency", "destinationCurrency", "chain", "sourceAccountId", "isInstant"]
		const acceptedFields = {
			"requestId": "string",
			"sourceUserId": "string",
			"destinationUserId": "string",
			"amount": "number",
			"sourceCurrency": "string",
			"destinationCurrency": "string",
			"chain": "string",
			"sourceAccountId": "string",
			"isInstant": "boolean"
		}
		
		const {missingFields, invalidFields} = fieldsValidation(fields, requiredFields, acceptedFields)
		if (missingFields.length > 0 || invalidFields.lenght > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })
		//check if sender is under profileId
		if (! (await verifyUser(sourceUserId, profileId))) return res.status(401).json({error: "Not authorized"})
		// check is chain supported
		if (!hifiSupportedChain.includes(chain)) return res.status(400).json({ error: `Unsupported chain: ${chain}` });
		// check is request id valid
		const record = await checkIsFiatToCryptoRequestIdAlreadyUsed(requestId, sourceUserId)
		if (record) return res.status(400).json({ error: `Request for requestId is already exist, please use get transaction endpoint with id: ${record.id}` }) 
		//check is source-destination pair supported
		const pair = `${sourceCurrency}-${destinationCurrency}`
		if (!(pair in FiatToCryptoSupportedPairFunctions)) return res.status(400).json({ error: `Unsupported rail for ${sourceCurrency} to ${destinationCurrency}` }); 

		const { transferFunc } = FiatToCryptoSupportedPairFunctions[pair]
		const transferResult = await transferFunc(requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId)
		return res.status(200).json(transferResult);

	}catch (error){
		if (error instanceof CreateFiatToCryptoTransferError){
			if (error.type == CreateFiatToCryptoTransferErrorType.CLIENT_ERROR){
				return res.status(400).json({error: error.message})
			}else{
				return res.status(500).json({error: "Unexpected error happened"})
			}
		}
		createLog("transfer/createFiatToCryptoTransfer", sourceUserId, error.message)
		return res.status(500).json({error: "Unexpected error happened"})
	}

}

exports.getFiatToCryptoTransfer = async(req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const { id } = req.query
	if (!id) return res.status(400).json({error: `id is required`})
	try{
		const transactionRecord = await fetchFiatToCryptoTransferRecord(id)

		if (!transactionRecord) return res.status(404).json({error: `No transaction found for id: ${id}`})
		return res.status(200).json(transactionRecord)

	}catch (error){
		createLog("transfer/getCryptoToFiatTransfer", null, error.message)
		return res.status(500).json({error: `Unexpected error happened`})
	}

}

