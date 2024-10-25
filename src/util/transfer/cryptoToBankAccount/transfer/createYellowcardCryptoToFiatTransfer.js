const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { getAddress, isAddress } = require("ethers");
const { transferType } = require("../../utils/transfer");
const { getFeeConfig } = require("../../fee/utils");
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveTokenBastion");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { v4 } = require("uuid");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const createYellowcardRequestForQuote = require("../../../yellowcard/createYellowcardRequestForQuote");
const { executeYellowcardExchange } = require("../../../yellowcard/utils/executeYellowcardExchange");
const fetchYellowcardCryptoToFiatTransferRecord = require("../../../../util/transfer/cryptoToBankAccount/transfer/fetchYellowcardCryptoToFiatTransferRecord");
const { getWalletColumnNameFromProvider, insertWalletTransactionRecord, transferToWallet } = require("../../walletOperations/utils");
const { insertYellowCardTransactionInfo, updateYellowCardTransactionInfo } = require("../../../yellowcard/transactionInfoService");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { insertSingleOfframpTransactionRecord, updateOfframpTransactionRecord } = require("../utils/offrampTransactionsTableService");
const createJob = require("../../../../../asyncJobs/createJob");
const { safeSum } = require("../../../utils/number");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { pollYellowcardExchangeForOrder, getYellowCardDepositInstruction } = require("../../../yellowcard/utils/pollYellowcardExchangeForOrder");

const initTransferData = async (config) => {

	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, sourceBastionUserId, paymentRail, purposeOfPayment, description, sourceWalletProvider: walletProvider, accountInfo, newRecord } = config

	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	// insert yellowcard transaction info
	const toInsertYCRecord = {
		user_id: sourceUserId,
	}
	const yellowcardTransactionRecord = await insertYellowCardTransactionInfo(toInsertYCRecord);

	// insert wallet transaction record
	const walletTxRecord = await insertWalletTransactionRecord(walletProvider, { user_id: sourceUserId, request_id: v4() });
	const walletColName = getWalletColumnNameFromProvider(walletProvider);

	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	const toUpdateOfframpRecord = {
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			transaction_status: 'AWAITING_QUOTE',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "YELLOWCARD",
			crypto_provider: walletProvider,
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
			purpose_of_payment: purposeOfPayment,
			description: description,
			amount: amount,
			billing_tags_success: billingTags.success,
			billing_tags_failed: billingTags.failed,
			yellowcard_transaction_record_id: yellowcardTransactionRecord.id,
			[walletColName]: walletTxRecord.id
	}

	const record = await updateOfframpTransactionRecord(newRecord.id, toUpdateOfframpRecord)
	if (recordError) throw recordError

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0) return { record: record, yellowcardTransactionRecord: yellowcardTransactionRecord }

	// insert fee record
	let { feePercent, feeAmount, clientReceivedAmount } = getFeeConfig(feeType, feeValue, amount)
	const info = {
		chargedUserId: sourceUserId,
		chain: chain,
		currency: sourceCurrency,
		chargedWalletAddress: sourceWalletAddress
	}
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, walletProvider, null, {[walletColName]: walletTxRecord.id})

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Amount after subtracting fee is less than 1 dollar`
		}
		record = await updateOfframpTransactionRecord(record.id, toUpdate)
		return { record: record, yellowcardTransactionRecord: yellowcardTransactionRecord }
	}

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${sourceCurrency} on ${chain}`
		}
		record = await updateOfframpTransactionRecord(record.id, toUpdate)
		return { record: record, yellowcardTransactionRecord: yellowcardTransactionRecord }
	}

	// get amount including developer fee
	const amountIncludingFee = parseFloat(safeSum([amount, feeAmount]).toFixed(2))

	// update into crypto to crypto table
	await updateOfframpTransactionRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress, amount_include_developer_fee: amountIncludingFee })
	return { record: record, feeRecord: feeRecord, yellowcardTransactionRecord: yellowcardTransactionRecord }
}

const transferWithFee = async (offrampTransactionRecord) => {

}

const transferWithoutFee = async (offrampTransactionRecord) => {
	try{
		const sourceCurrency = offrampTransactionRecord.source_currency
		const sourceUserId = offrampTransactionRecord.user_id
		const walletType = offrampTransactionRecord.transfer_from_wallet_type
		// Execute the exchange process, which returns chain and liquidation address
		const {order, bearerDid} = await executeYellowcardExchange(offrampTransactionRecord);
		const {chain, liquidationAddress} = await getYellowCardDepositInstruction(order, offrampTransactionRecord, bearerDid);


		// send transaction
		const decimals = currencyDecimal[sourceCurrency]
		const transferAmount = toUnitsString(amount, decimals)

		const { bastionUserId, circleWalletId } = await getUserWallet(sourceUserId, chain, walletType);
		const providerRecordId = offrampTransactionRecord[getWalletColumnNameFromProvider(walletProvider)]
		const transferConfig = {
			referenceId: offrampTransactionRecord.id, 
			senderCircleWalletId: circleWalletId, 
			senderBastionUserId: bastionUserId,
			currency: sourceCurrency, 
			unitsAmount: transferAmount, 
			chain: chain, 
			destinationAddress: liquidationAddress, 
			transferType: transferType.CRYPTO_TO_FIAT,
			providerRecordId
		}
		const {response, responseBody, failedReason, providerStatus, mainTableStatus} = await transferToWallet(walletProvider, transferConfig)
		
		const offrampTransactionRecordToUpdate = {
			transaction_status: mainTableStatus,
			updated_at: new Date().toISOString()
		}

		if (!response.ok) {
			offrampTransactionRecordToUpdate.failed_reason = failedReason
		}

		const updatedOfframpTransactionRecord = await updateOfframpTransactionRecord(offrampTransactionRecord.id, offrampTransactionRecordToUpdate)
		await notifyCryptoToFiatTransfer(updatedOfframpTransactionRecord)

	} catch (error) {
		await createLog("transfer/yellowcard/transferWithoutFee", config.sourceUserId, error.message, error)
		throw new Error(`Error processing transfer: ${error.message}`);
	}

}

const createYellowcardCryptoToFiatTransfer = async (config) => {
	const { destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceUserId, destinationUserId, description, purposeOfPayment } = config

	//insert request record
	const { record: initialTransferRecord, feeRecord: feeRecord, yellowcardTransactionRecord: yellowcardTransactionRecord } = await initTransferData(config)

	const jobConfig = {
		offrampTransactionRecordId: initialTransferRecord.id,
	}
	await createJob("getQuote", jobConfig, sourceUserId, profileId)

	return { isExternalAccountExist: true, transferResult: result }
}

const acceptYellowcardCryptoToFiatTransfer = async (config) => {
	const { recordId, profileId } = config;
	try {
		// Fetch the offramp transaction record by recordId
		const { data: record, error: recordError } = await supabase
			.from("offramp_transactions")
			.select("*, yellowcard_transaction_info:yellowcard_transaction_record_id (*)")
			.eq("id", recordId)
			.maybeSingle();

		if (recordError) {
			console.error('Database error when fetching offramp transaction:', recordError.message);
			throw new Error(`Database error: ${recordError.message}`);
		}
		if (!record) {
			console.error('No transaction found for the provided record ID:', recordId);
			throw new Error("No transaction found for provided record Id");
		}

		// check if balance is enough for transaction fee
		if (!await checkBalanceForTransactionFee(record.id, transferType.CRYPTO_TO_FIAT)) {
			const toUpdate = {
				transaction_status: "NOT_INITIATED",
				failed_reason: "Insufficient balance for transaction fee"
			}
			await updateOfframpTransactionRecord(record.id, toUpdate);
			const result = fetchYellowcardCryptoToFiatTransferRecord(record.id, profileId);
			return result
		}

		// check if balance is enough for transaction amount
		if(!await checkBalanceForTransactionAmount(sourceUserId, amount, chain, sourceCurrency)){
			const toUpdate = {
				transaction_status: "NOT_INITIATED",
				failed_reason: "Transfer amount exceeds wallet balance"
			}
			await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate)
			const result = await fetchYellowcardCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
			return result
		}

		// create job
		const jobConfig = {
			offrampTransactionRecordId: initialTransferRecord.id,
		}
		await createJob("cryptoToFiatTransfer", jobConfig, sourceUserId, profileId)

		// update offramp transaction record
		const toUpdateOfframpRecord = {
			transaction_status: "CREATED",
			updated_at: new Date().toISOString()
		}
		await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord)

		const result = await fetchYellowcardCryptoToFiatTransferRecord(record.id, profileId);
		return result;

	} catch (error) {
		await createLog("transfer/createYellowcardCryptoToFiatTransfer", sourceUserId, error.message, error)
		throw new Error(`Error processing transfer: ${error.message}`);
	}
};

// this should already contain every information needed for transfer
const executeAsyncTransferCryptoToFiat = async (config) => {
	const { recordId } = config;
	// fetch from created record
	const { data, error } = await supabase
		.from('offramp_transactions')
		.select("*, yellowcard_transaction_info:yellowcard_transaction_record_id(*), feeRecord: developer_fee_id(*)")
		.eq("id", recordId)
		.single()

	if (error) {
		await createLog("transfer/yellowcard/executeAsyncTransferCryptoToFiat", data.user_id, error.message)
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
	createYellowcardCryptoToFiatTransfer,
	acceptYellowcardCryptoToFiatTransfer,
	executeAsyncTransferCryptoToFiat
}