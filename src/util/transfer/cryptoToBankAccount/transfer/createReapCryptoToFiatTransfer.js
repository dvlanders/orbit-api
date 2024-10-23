const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { getAddress, isAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { getFeeConfig } = require("../../fee/utils");
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveToken");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { v4 } = require("uuid");
const createPaymentQuote = require("../../../reap/main/createPayment");
const fetchReapCryptoToFiatTransferRecord = require("./fetchReapCryptoToFiatTransferRecord");
const getUserReapWalletAddress = require("../../../reap/main/getUserWallet");
const acceptPaymentQuote = require("../../../reap/main/acceptPaymentQuote");
const getReapPayment = require("../../../reap/main/getPayment");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../utils/simulateSandboxCryptoToFiatTransaction");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { insertWalletTransactionRecord, getWalletColumnNameFromProvider, transferToWallet, transferToWalletWithPP } = require("../../walletOperations/utils");
const { updateOfframpTransactionRecord } = require("../utils/offrampTransactionsTableService");
const { safeParseBody } = require("../../../utils/response");
const { insertSingleReapTransactionRecord, updateReapTransactionRecord } = require("../../../reap/utils/reapTransactionTableService");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { getUserWallet } = require("../../../user/getUserWallet");
const { updateFeeRecord } = require("../../fee/updateFeeRecord");
const { safeSum } = require("../../../utils/number");

const initTransferData = async (config) => {
	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, sourceBastionUserId, paymentRail, purposeOfPayment, receivedAmount, description, accountInfo, feeTransactionId, sourceWalletProvider, newRecord } = config

	// insert wallet provider record// insert wallet provider record
	const toInsertProviderRecord = {
		user_id: sourceUserId,
		request_id: v4()
	}

	const walletProviderRecord = await insertWalletTransactionRecord(sourceWalletProvider, toInsertProviderRecord)

	// insert reap transaction record
	const toInsertReapRecord = {
		user_id: sourceUserId,
		request_id: v4()
	}
	const reapRecord = await insertSingleReapTransactionRecord(toInsertReapRecord)

	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	// get Reap wallet Address 
	const userReapWalletAddress = await getUserReapWalletAddress(destinationUserId, chain)

	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	// insert offramp transaction record
	const toInsertOfframpRecord = {
		user_id: sourceUserId,
		destination_user_id: destinationUserId,
		chain: chain,
		from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
		to_wallet_address: isAddress(userReapWalletAddress) ? getAddress(userReapWalletAddress) : userReapWalletAddress,
		transaction_status: 'OPEN_QUOTE',
		contract_address: contractAddress,
		fiat_provider: "REAP",
		crypto_provider: sourceWalletProvider,
		source_currency: sourceCurrency,
		destination_currency: destinationCurrency,
		destination_account_id: destinationAccountId,
		transfer_from_wallet_type: sourceWalletType,
		purpose_of_payment: purposeOfPayment,
		description: description, 
		destination_currency_amount: receivedAmount,
		billing_tags_success: billingTags.success,
		billing_tags_failed: billingTags.failed,
		fee_transaction_id: feeTransactionId,
		[getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id,
		reap_transaction_record_id: reapRecord.id,
	}
	const offrampRecord = await updateOfframpTransactionRecord(newRecord.id, toInsertOfframpRecord)

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0) return {offrampRecord, feeRecord: null, validTransaction: true}

	// insert fee record
	let { feePercent, feeAmount } = getFeeConfig(feeType, feeValue, amount)
	const info = {
		chargedUserId: sourceUserId,
		chain: chain,
		currency: sourceCurrency,
		chargedWalletAddress: sourceWalletAddress
	}
	const feeRecord = await createNewFeeRecord(offrampRecord.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, sourceWalletProvider, null, {[getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id})

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${currency} on ${chain}`
		}
		offrampRecord = await updateOfframpTransactionRecord(offrampRecord.id, toUpdate)
		return {offrampRecord, feeRecord, validTransaction: false}
	}

	// update into crypto to crypto table
	await updateOfframpTransactionRecord(offrampRecord.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress })
	return {offrampRecord, feeRecord, validTransaction: true}
}

const transferWithFee = async (initialTransferRecord, profileId) => {
	const paymentProcessorContractAddress = initialTransferRecord.payment_processor_contract_address
	const sourceUserId = initialTransferRecord.user_id
	const sourceCurrency = initialTransferRecord.source_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const walletType = initialTransferRecord.transfer_from_wallet_type
	const feeRecord = initialTransferRecord.feeRecord
	const destinationWalletAddress = initialTransferRecord.to_wallet_address 
	const { bastionUserId, circleWalletId, walletProvider } = await getUserWallet(sourceUserId, chain, walletType)

	//get payment rail
	const feeCollectionWalletAddress = feeRecord.fee_collection_wallet_address
    const feeUnitsAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
    const unitsAmount = toUnitsString(amount, currencyDecimal[sourceCurrency]) 
    const providerRecordId = initialTransferRecord[getWalletColumnNameFromProvider(walletProvider)]

	// perfrom transfer with fee
    const transferConfig = {
        referenceId: initialTransferRecord.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: sourceCurrency, 
        unitsAmount, 
        chain, 
        destinationAddress: destinationWalletAddress, 
        transferType: transferType.CRYPTO_TO_FIAT,
        paymentProcessorContract: paymentProcessorContractAddress,
        feeUnitsAmount,
        feeCollectionWalletAddress,
        providerRecordId,
        paymentProcessType: "EXACT_OUT"
    }

    const {response, responseBody, mainTableStatus, providerStatus, failedReason, feeRecordStatus} = await transferToWalletWithPP(walletProvider, transferConfig)

	// update offramp transaction record
	const toUpdateOfframpRecord ={
        transaction_status: mainTableStatus,
        updated_at: new Date().toISOString(),
    }
    const toUpdateFeeRecord = {
        charged_status: feeRecordStatus,
        updated_at: new Date().toISOString(),
    }

	if (!response.ok) {
        await createLog("transfer/reap/transferWithFee", sourceUserId, responseBody.message, responseBody)
        toUpdateOfframpRecord.failed_reason = failedReason
        toUpdateFeeRecord.failed_reason = failedReason
    }
    const [updatedOfframpRecord, updatedFeeRecord] = await Promise.all([
        updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord),
        updateFeeRecord(feeRecord.id, toUpdateFeeRecord)
    ])

	if (mainTableStatus == "SUBMITTED_ONCHAIN"){
		const jobConfig = {
			offrampRecordId: updatedOfframpRecord.id
		}
		await createJob("reapApproveFunds", jobConfig, sourceUserId, profileId)
	}

	const result = await fetchReapCryptoToFiatTransferRecord(updatedOfframpRecord.id, profileId)
	return result
}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
	const sourceUserId = initialTransferRecord.user_id
	const sourceCurrency = initialTransferRecord.source_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const walletType = initialTransferRecord.transfer_from_wallet_type
	const destinationWalletAddress = initialTransferRecord.to_wallet_address
	const { bastionUserId, circleWalletId, walletProvider } = await getUserWallet(sourceUserId, chain, walletType)

	// sandbox simulation
	if (process.env.NODE_ENV == "development") {
		const toUpdate = {
			updated_at: new Date().toISOString(),
			destination_currency_amount: amount,
			to_wallet_address: destinationWalletAddress,
			transaction_status: "COMPLETED",
			failed_reason: "This is a simulated success response for sandbox environment only."
		}

		await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate)
		await simulateSandboxCryptoToFiatTransactionStatus(initialTransferRecord)
		const result = await fetchReapCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return result
	}

	//get payment rail
	const decimals = currencyDecimal[sourceCurrency]
	const transferAmount = toUnitsString(amount, decimals)

	const providerRecordId = initialTransferRecord[getWalletColumnNameFromProvider(walletProvider)]
	const transferConfig = {
		referenceId: initialTransferRecord.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: sourceCurrency, 
        unitsAmount: transferAmount, 
        chain: chain, 
        destinationAddress: destinationWalletAddress, 
        transferType: transferType.CRYPTO_TO_FIAT,
        providerRecordId
	}
	const {response: walletResponse, responseBody: walletResponseBody, failedReason, providerStatus: walletProviderStatus, mainTableStatus} = await transferToWallet(walletProvider, transferConfig)

	// map status
	consttoUpdateOfframpRecord = {
		updated_at: new Date().toISOString(),
		transaction_status: mainTableStatus
	}
	if (!walletResponse.ok) {
		// fail to transfer
		await createLog("transfer/reap/transferWithoutFee", sourceUserId, walletResponseBody.message, walletResponseBody)
		toUpdateOfframpRecord.failed_reason = failedReason
	}
	const updatedRecord = await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord)

	// create job
	if (mainTableStatus == "SUBMITTED_ONCHAIN"){
		const jobConfig = {
			offrampRecordId: updatedRecord.id
		}
		await createJob("reapApproveFunds", jobConfig, sourceUserId, profileId)
	}

	const result = await fetchReapCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return result
}

const createReapCryptoToFiatTransfer = async (config) => {

	const { destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceUserId, destinationUserId, description, purposeOfPayment, receivedAmount, feeTransactionId } = config
	
    //insert request record
	const {offrampRecord: initialTransferRecord, feeRecord, validTransaction} = await initTransferData(config)
	if(!validTransaction){
		const result = fetchReapCryptoToFiatTransferRecord(initialTransferRecord.id, profileId);
		return { isExternalAccountExist: true, transferResult: result };
	}
	const developerFeeAmount = feeRecord? feeRecord.fee_amount : 0

    // create quote and update record
    const paymentConfig = {
        amount: receivedAmount,
        destinationCurrency: destinationCurrency.toUpperCase(),
        sourceCurrency: sourceCurrency.toUpperCase(),
        description: description,
        purposeOfPayment: purposeOfPayment,
		offrampRecordId: initialTransferRecord.id
    }
    const reapQuoteResponse = await createPaymentQuote(destinationUserId, destinationAccountId, paymentConfig)
    const reapQuoteResponseBody = await safeParseBody(reapQuoteResponse)

	const toUpdateReapTransactionRecord = {
		reap_response: reapQuoteResponseBody,
		updated_at: new Date().toISOString()
	}

	const toUpdateOfframpTransactionRecord = {
		updated_at: new Date().toISOString()
	}

    if (!reapQuoteResponse.ok){
        await createLog("transfer/createReapCryptoToFiatTransfer", sourceUserId, reapQuoteResponseBody.message, reapQuoteResponseBody)
        toUpdateOfframpTransactionRecord.transaction_status = "NOT_INITIATED"
        toUpdateOfframpTransactionRecord.failed_reason = "Quote creation failed, please contact HIFI for more information"
        toUpdateOfframpTransactionRecord.amount = 0
		toUpdateOfframpTransactionRecord.amount_include_developer_fee = 0
    }else{
        // get conversion rate
        const conversionRate = {
            validFrom: reapQuoteResponseBody.validFrom,
            toCurrency: destinationCurrency,
            validUntil: reapQuoteResponseBody.validTo,
            fromCurrency: sourceCurrency,
            conversionRate: reapQuoteResponseBody.fxInfo.clientRate
          }

		toUpdateReapTransactionRecord.reap_payment_status = reapQuoteResponseBody.status
		toUpdateReapTransactionRecord.reap_payment_id = reapQuoteResponseBody.paymentId
        toUpdateOfframpTransactionRecord.conversion_rate = conversionRate
        toUpdateOfframpTransactionRecord.provider_fee = reapQuoteResponseBody.feeInfo.totalFee
        toUpdateOfframpTransactionRecord.amount = reapQuoteResponseBody.paymentInfo.senderAmount
		toUpdateOfframpTransactionRecord.amount_include_developer_fee = parseFloat(safeSum([reapQuoteResponseBody.paymentInfo.senderAmount, developerFeeAmount]).toFixed(2))
        toUpdateOfframpTransactionRecord.destination_currency_amount = reapQuoteResponseBody.paymentInfo.receivingAmount
		toUpdateOfframpTransactionRecord.transaction_status = "OPEN_QUOTE"
    }

	const [updatedOfframpRecord, updatedReapRecord] = await Promise.all([
		updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpTransactionRecord),
		updateReapTransactionRecord(initialTransferRecord.reap_transaction_record_id, toUpdateReapTransactionRecord)
	])

	const result = await fetchReapCryptoToFiatTransferRecord(updatedOfframpRecord.id, profileId)
	return { isExternalAccountExist: true, transferResult: result }
}

const acceptReapCryptoToFiatTransfer = async(config) => {
	const {recordId, profileId} = config
    // accept quote and update record
	const {data: record, error: recordError} = await supabase
		.from("offramp_transactions")
		.select("reapTransaction: reap_transaction_record_id(reap_payment_id), user_id, destination_user_id, reap_transaction_record_id, source_currency, chain, amount, amount_include_developer_fee")
		.eq("id", recordId)
		.maybeSingle()

	if (recordError) throw recordError
	if (!record) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "No transaction for provided record Id")

	// check balance for transaction fee
	if(!await checkBalanceForTransactionFee(recordId, transferType.CRYPTO_TO_FIAT)){
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Insufficient balance for transaction fee"
		}
		await updateOfframpTransactionRecord(recordId, toUpdate);
		const result = fetchReapCryptoToFiatTransferRecord(recordId, profileId);
		return { isExternalAccountExist: true, transferResult: result };
	}

	// check balance
	const amountToCheck = Math.max(record.amount_include_developer_fee, record.amount)
	if(!await checkBalanceForTransactionAmount(record.user_id, amountToCheck, record.chain, record.source_currency)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance",
			updated_at: new Date().toISOString()
        }
        await updateOfframpTransactionRecord(recordId, toUpdate)
        const result = fetchReapCryptoToFiatTransferRecord(recordId, profileId)
		return result
    }

	const reapPaymentId = record.reapTransaction.reap_payment_id
	
	// accept quote
	const response = await acceptPaymentQuote(reapPaymentId, record.destination_user_id)
	const responseBody = await safeParseBody(response)

	let toUpdateReapTransactionRecord = {
		reap_response: responseBody,
		updated_at: new Date().toISOString()
	}

	let toUpdateOfframpTransactionRecord = {
		updated_at: new Date().toISOString()
	}

	// quote failed
	if (!response.ok){
		toUpdateOfframpTransactionRecord.failed_reason = "Quote accept failed"
		toUpdateOfframpTransactionRecord.transaction_status = "QUOTE_FAILED"
		if (responseBody.code == "PAAS0003" && responseBody.message == "Quote has been expired"){
			toUpdateOfframpTransactionRecord.failed_reason = "Quote expired"
		}
		const [updatedOfframpRecord, updatedReapRecord] = await Promise.all([
			updateOfframpTransactionRecord(recordId, toUpdateOfframpTransactionRecord),
			updateReapTransactionRecord(record.reap_transaction_record_id, toUpdateReapTransactionRecord)
		])
		const result = await fetchReapCryptoToFiatTransferRecord(updatedOfframpRecord.id, profileId)
		return result
	}

	// get latest payment
	const updatedPaymentresponse = await getReapPayment(record.reapTransaction.reap_payment_id, record.destination_user_id)
	const updatedPaymentresponseBody = await safeParseBody(updatedPaymentresponse)

	toUpdateReapTransactionRecord = {
		reap_response: updatedPaymentresponseBody,
		updated_at: new Date().toISOString()
	}

	toUpdateOfframpTransactionRecord = {
		updated_at: new Date().toISOString()
	}

	// payment failed
	if (!updatedPaymentresponse.ok){
		await createLog("transfer/acceptReapCryptoToFiatTransfer", record.user_id, updatedPaymentresponseBody.message, updatedPaymentresponseBody)
		toUpdateOfframpTransactionRecord.failed_reason = "Quote accept failed"
		toUpdateOfframpTransactionRecord.transaction_status = "QUOTE_FAILED"
	}else{
		toUpdateOfframpTransactionRecord.transaction_status = "CREATED"
		toUpdateReapTransactionRecord.reap_payment_status = updatedPaymentresponseBody.status
	}

	const [updatedOfframpRecord, updatedReapRecord] = await Promise.all([
		updateOfframpTransactionRecord(recordId, toUpdateOfframpTransactionRecord),
		updateReapTransactionRecord(record.reap_transaction_record_id, toUpdateReapTransactionRecord)
	])

    // create Job
	const jobConfig = {
		recordId
	}
	await createJob("cryptoToFiatTransfer", jobConfig, record.user_id, profileId)

	const result = await fetchReapCryptoToFiatTransferRecord(recordId, profileId)
    return result
}

// this should already contain every information needed for transfer
const executeAsyncTransferCryptoToFiat = async (config) => {
	// fetch from created record
	const { data, error } = await supabase
		.from('offramp_transactions')
		.select("*, reapTransaction: reap_transaction_record_id(*), feeRecord: developer_fee_id(*)")
		.eq("id", config.recordId)
		.single()

	if (error) {
		await createLog("transfer/util/executeAsyncTransferCryptoToFiat", data.user_id, error.message)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	// transfer
	let receipt
	if (data.developer_fee_id) {
		receipt = await transferWithFee(data, config.profileId)
	} else {
		receipt = await transferWithoutFee(data, config.profileId)
	}
	// notify user
	await notifyCryptoToFiatTransfer(data)
	return receipt

}

module.exports = {
	createReapCryptoToFiatTransfer,
	acceptReapCryptoToFiatTransfer,
	executeAsyncTransferCryptoToFiat
}