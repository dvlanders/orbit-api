const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const bridgeRailCheck = require("../railCheck/bridgeRailCheckV2");
const { getAddress, isAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { getFeeConfig } = require("../../fee/utils");
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap");
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveTokenBastion");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount");
const { CryptoToFiatWithFeeBastion } = require("../../fee/CryptoToFiatWithFeeBastion");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const { cryptoToFiatTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoToFiatTransfer/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { getMappedError } = require("../../../bastion/utils/errorMappings");
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck");
const getBridgeConversionRate = require("../../conversionRate/main/getBridgeCoversionRate");
const { v4 } = require("uuid");
const fetchBridgeCryptoToFiatTransferRecord = require("./fetchBridgeCryptoToFiatTransferRecordV2");
const { chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const createBridgeTransfer = require("../../../bridge/endpoint/createTransfer");
const { fetchAccountProviders } = require("../../../account/accountProviders/accountProvidersService");
const { safeStringToFloat } = require("../../../utils/number");
const createPaymentQuote = require("../../../reap/main/createPayment");
const fetchTbdexCryptoToFiatTransferRecord = require("./fetchTbdexCryptoToFiatTransferRecord");
const getUserReapWalletAddress = require("../../../reap/main/getUserWallet");
const acceptPaymentQuote = require("../../../reap/main/acceptPaymentQuote");
const getReapPayment = require("../../../reap/main/getPayment");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../utils/simulateSandboxCryptoToFiatTransaction");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const createYellowcardRequestForQuote = require("../../../yellowcard/createTbdexRequestForQuote");

const initTransferData = async (config) => {

	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, sourceBastionUserId, paymentRail, purposeOfPayment, receivedAmount, description } = config

	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]



	// create initial transfer record on yellowcard_transactions
	const { data: yellowcardTransactionRecord, error: yellowcardTransactionRecordError } = await supabase
		.from('yellowcard_transactions')
		.insert({
			user_id: sourceUserId,
		})
		.select()
		.single()

	if (yellowcardTransactionRecordError) throw yellowcardTransactionRecordError


	//insert the initial record
	const { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.update({
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			// to_wallet_address: isAddress(userReapWalletAddress) ? getAddress(userReapWalletAddress) : userReapWalletAddress,
			transaction_status: 'OPEN_QUOTE',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "YELLOWCARD",
			crypto_provider: "BASTION",
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
			bastion_user_id: sourceBastionUserId,
			purpose_of_payment: purposeOfPayment,
			description: description,
			destination_currency_amount: receivedAmount,
			yellowcard_transaction_id: yellowcardTransactionRecord.id,
		})
		.eq("request_id", requestId)
		.select()
		.single()



	if (recordError) throw recordError

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0) return { record }

	// insert fee record
	let { feePercent, feeAmount, clientReceivedAmount } = getFeeConfig(feeType, feeValue, amount)
	const info = {
		chargedUserId: sourceUserId,
		chain: chain,
		currency: sourceCurrency,
		chargedWalletAddress: sourceWalletAddress
	}
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, "BASTION", record.request_id)

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Amount after subtracting fee is less than 1 dollar`
		}
		record = await updateRequestRecord(record.id, toUpdate)
		return { record }
	}

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${currency} on ${chain}`
		}
		record = await updateRequestRecord(record.id, toUpdate)
		return { record }
	}

	// update into crypto to crypto table
	await updateRequestRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress })
	return { record, feeRecord }
}

const transferWithFee = async (initialTransferRecord, profileId) => {
	const sourceCurrency = initialTransferRecord.source_currency
	const chain = initialTransferRecord.chain
	const sourceWalletAddress = initialTransferRecord.from_wallet_address
	const developerFeeId = initialTransferRecord.developer_fee_id
	const paymentProcessorContractAddress = initialTransferRecord.payment_processor_contract_address
	const bastionUserId = initialTransferRecord.bastion_user_id
	// get fee config
	const { data: feeRecord, error: feeRecordError } = await supabase
		.from("developer_fees")
		.select("*")
		.eq("id", developerFeeId)
		.single()

	if (feeRecordError) throw feeRecordError

	const result = await CryptoToFiatWithFeeBastion(initialTransferRecord, feeRecord, paymentProcessorContractAddress, profileId)
	return result

}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
	const sourceUserId = initialTransferRecord.user_id
	const sourceCurrency = initialTransferRecord.source_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const bastionUserId = initialTransferRecord.bastion_user_id

	//get payment rail
	const decimals = currencyDecimal[sourceCurrency]
	const transferAmount = toUnitsString(amount, decimals)
	const bodyObject = {
		requestId: initialTransferRecord.bastion_request_id,
		userId: bastionUserId,
		contractAddress: initialTransferRecord.contract_address,
		actionName: "transfer",
		chain: chain,
		actionParams: erc20Transfer(sourceCurrency, chain, initialTransferRecord.to_wallet_address, transferAmount)
	};

	const bastionResponse = await submitUserAction(bodyObject)
	const bastionResponseBody = await bastionResponse.json();

	// map status
	if (!bastionResponse.ok) {
		// fail to transfer
		await createLog("transfer/util/createTransferToBridgeLiquidationAddress", sourceUserId, bastionResponseBody.message, bastionResponseBody)
		const { message, type } = getMappedError(bastionResponseBody.message)

		const toUpdate = {
			bastion_response: bastionResponseBody,
			bastion_transaction_status: "FAILED",
			transaction_status: "NOT_INITIATED",
			failed_reason: message
		}

		// in sandbox, just return SUBMITTED_ONCHAIN status
		if (process.env.NODE_ENV == "development") {
			toUpdate.transaction_status = "COMPLETED"
			toUpdate.failed_reason = "This is a simulated success response for sandbox environment only."
		}

		await updateRequestRecord(initialTransferRecord.id, toUpdate)

		// send out webhook message if in sandbox
		if (process.env.NODE_ENV == "development") {
			await simulateSandboxCryptoToFiatTransactionStatus(initialTransferRecord)
		}

	} else {

		const toUpdate = {
			bastion_response: bastionResponseBody,
			transaction_hash: bastionResponseBody.transactionHash,
			bastion_transaction_status: bastionResponseBody.status,
			transaction_status: bastionResponseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN",
			failed_reason: bastionResponseBody.failureDetails,
		}
		await updateRequestRecord(initialTransferRecord.id, toUpdate)
	}

	const result = await fetchReapCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return result
}

const createTbdexCryptoToFiatTransfer = async (config) => {
	const { destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceUserId, destinationUserId, description, purposeOfPayment, receivedAmount, internalAccountId } = config

	//insert request record
	const { record: initialTransferRecord, feeRecord } = await initTransferData(config)

	if (!await checkBalanceForTransactionFee(initialTransferRecord.id, transferType.CRYPTO_TO_FIAT)) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Insufficient balance for transaction fee"
		}
		await updateRequestRecord(initialTransferRecord.id, toUpdate);
		const result = fetchTbdexCryptoToFiatTransferRecord(initialTransferRecord.id, profileId);
		return { isExternalAccountExist: true, transferResult: result };
	}

	// create quote and update record
	// const paymentConfig = {
	// 	amount: receivedAmount,
	// 	destinationCurrency: destinationCurrency.toUpperCase(),
	// 	sourceCurrency: sourceCurrency.toUpperCase(),
	// 	description: description,
	// 	purposeOfPayment: purposeOfPayment,
	// 	internalAccountId: internalAccountId,
	// }

	// const reapQuoteResponse = await createPaymentQuote(destinationUserId, destinationAccountId, paymentConfig)
	// create the quote

	const tbdexQuoteResponse = await createYellowcardRequestForQuote(destinationUserId, destinationAccountId, receivedAmount, destinationCurrency, sourceCurrency, description, purposeOfPayment, internalAccountId)




	// const reapQuoteResponseBody = await reapQuoteResponse.json()
	// if (!reapQuoteResponse.ok) {
	// 	await createLog("transfer/createReapCryptoToFiatTransfer", sourceUserId, reapQuoteResponseBody.message, reapQuoteResponseBody)
	// 	const toUpdate = {
	// 		transaction_status: "NOT_INITIATED",
	// 		reap_payment_response: reapQuoteResponseBody,
	// 		failed_reason: "Quote creation failed, please contact HIFI for more information",
	// 		amount: 0
	// 	}
	// 	await updateRequestRecord(initialTransferRecord.id, toUpdate)
	// } else {
	// 	// get conversion rate
	// 	const conversionRate = {
	// 		validFrom: reapQuoteResponseBody.validFrom,
	// 		toCurrency: destinationCurrency,
	// 		validUntil: reapQuoteResponseBody.validTo,
	// 		fromCurrency: sourceCurrency,
	// 		conversionRate: reapQuoteResponseBody.fxInfo.clientRate
	// 	}

	// 	const toUpdate = {
	// 		reap_payment_response: reapQuoteResponseBody,
	// 		reap_payment_status: reapQuoteResponseBody.status,
	// 		reap_payment_id: reapQuoteResponseBody.paymentId,
	// 		conversion_rate: conversionRate,
	// 		provider_fee: reapQuoteResponseBody.feeInfo.totalFee,
	// 		amount: reapQuoteResponseBody.paymentInfo.senderAmount,
	// 		destination_currency_amount: reapQuoteResponseBody.paymentInfo.receivingAmount

	// 	}
	// 	await updateRequestRecord(initialTransferRecord.id, toUpdate)
	// }

	// const result = await fetchReapCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return { isExternalAccountExist: true, transferResult: result }
}

const acceptTbdexCryptoToFiatTransfer = async (config) => {
	const { recordId, profileId } = config
	// accept quote and update record
	const { data: record, error: recordError } = await supabase
		.from("offramp_transactions")
		.select("reap_payment_id, user_id, destination_user_id")
		.eq("id", recordId)
		.maybeSingle()

	if (recordError) throw recordError
	if (!record) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "No transaction for provided record Id")

	// accept quote
	const response = await acceptPaymentQuote(record.reap_payment_id, record.destination_user_id)
	const responseBody = await response.json()
	if (!response.ok) {
		let failed_reason = "Quote accept failed"
		if (responseBody.code == "PAAS0003" && responseBody.message == "Quote has been expired") {
			failed_reason = "Quote expired"
		}
		const toUpdate = {
			transaction_status: "QUOTE_FAILED",
			reap_payment_response: responseBody,
			failed_reason
		}

		await updateRequestRecord(recordId, toUpdate)
		const result = await fetchReapCryptoToFiatTransferRecord(recordId, profileId)
		return result
	}

	// get latest payment
	const updatedPaymentresponse = await getReapPayment(record.reap_payment_id, record.destination_user_id)
	const updatedPaymentresponseBody = await updatedPaymentresponse.json()
	if (!response.ok) {
		await createLog("transfer/acceptReapCryptoToFiatTransfer", record.user_id, updatedPaymentresponseBody.message, updatedPaymentresponseBody)
		const result = await fetchReapCryptoToFiatTransferRecord(recordId, profileId)
		return result
	}
	const toUpdate = {
		transaction_status: "CREATED",
		reap_payment_response: updatedPaymentresponseBody,
		reap_payment_status: updatedPaymentresponseBody.status
	}
	await updateRequestRecord(recordId, toUpdate)

	// create Job
	const jobConfig = {
		recordId
	}
	if (await cryptoToFiatTransferScheduleCheck("cryptoToFiatTransfer", jobConfig, record.user_id, profileId)) {
		await createJob("cryptoToFiatTransfer", jobConfig, record.user_id, profileId)
	}

	const result = await fetchReapCryptoToFiatTransferRecord(recordId, profileId)
	return result
}


// // this should already contain every information needed for transfer
// const executeAsyncTransferCryptoToFiat = async (config) => {
// 	// fetch from created record
// 	const { data, error } = await supabase
// 		.from('offramp_transactions')
// 		.select("*")
// 		.eq("id", config.recordId)
// 		.single()

// 	if (error) {
// 		await createLog("transfer/util/executeAsyncTransferCryptoToFiat", data.user_id, error.message)
// 		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
// 	}

// 	// transfer
// 	let receipt
// 	if (data.developer_fee_id) {
// 		receipt = await transferWithFee(data, config.profileId)
// 	} else {
// 		receipt = await transferWithoutFee(data, config.profileId)
// 	}
// 	// notify user
// 	await notifyCryptoToFiatTransfer(data)
// 	return receipt

// }

module.exports = {
	createTbdexCryptoToFiatTransfer,
	acceptTbdexCryptoToFiatTransfer,
	// executeAsyncTransferCryptoToFiat
}