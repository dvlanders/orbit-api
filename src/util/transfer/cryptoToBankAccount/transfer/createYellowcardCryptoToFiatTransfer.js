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
const { getWalletColumnNameFromProvider, insertWalletTransactionRecord } = require("../../walletOperations/utils");
const { insertYellowCardTransactionInfo, updateYellowCardTransactionInfo } = require("../../../yellowcard/transactionInfoService");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");

const initTransferData = async (config) => {

	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, sourceBastionUserId, paymentRail, purposeOfPayment, description, sourceWalletProvider: walletProvider, accountInfo } = config

	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	const toInsertYCRecord = {
		user_id: sourceUserId,
	}
	const yellowcardTransactionRecord = await insertYellowCardTransactionInfo(toInsertYCRecord);

	const walletTxRecord = await insertWalletTransactionRecord(walletProvider, { user_id: sourceUserId, request_id: v4() });
	const walletColName = getWalletColumnNameFromProvider(walletProvider);

	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	const { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.update({
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			transaction_status: 'OPEN_QUOTE',
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
			yellowcard_transaction_id: yellowcardTransactionRecord.id,
			[walletColName]: walletTxRecord.id
		})
		.eq("request_id", requestId)
		.select()
		.single()

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
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, walletProvider, record.request_id)

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Amount after subtracting fee is less than 1 dollar`
		}
		record = await updateRequestRecord(record.id, toUpdate)
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
		record = await updateRequestRecord(record.id, toUpdate)
		return { record: record, yellowcardTransactionRecord: yellowcardTransactionRecord }
	}

	// update into crypto to crypto table
	await updateRequestRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress })
	return { record: record, feeRecord: feeRecord, yellowcardTransactionRecord: yellowcardTransactionRecord }
}

const createYellowcardCryptoToFiatTransfer = async (config) => {
	const { destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceUserId, destinationUserId, description, purposeOfPayment } = config

	//insert request record
	const { record: initialTransferRecord, feeRecord: feeRecord, yellowcardTransactionRecord: yellowcardTransactionRecord } = await initTransferData(config)

	if (!await checkBalanceForTransactionFee(initialTransferRecord.id, transferType.CRYPTO_TO_FIAT)) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Insufficient balance for transaction fee"
		}
		await updateRequestRecord(initialTransferRecord.id, toUpdate);
		const result = fetchYellowcardCryptoToFiatTransferRecord(initialTransferRecord.id, profileId);
		return { isExternalAccountExist: true, transferResult: result };
	}

	if(!await checkBalanceForTransactionAmount(sourceUserId, amount, chain, sourceCurrency)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const result = await fetchYellowcardCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }

	const { yellowcardRequestForQuote } = await createYellowcardRequestForQuote(destinationUserId, destinationAccountId, amount, destinationCurrency, sourceCurrency, description, purposeOfPayment)

	if (yellowcardRequestForQuote) {
		const toUpdateYC = {
			yellowcard_rfq_response: yellowcardRequestForQuote,
			payout_units_per_payin_unit: yellowcardRequestForQuote.data.payoutUnitsPerPayinUnit,
			quote_id: yellowcardRequestForQuote.metadata.id,
			quote_expires_at: new Date(yellowcardRequestForQuote.data.expiresAt).toISOString().replace('Z', '+00:00'),
		}
		await updateYellowCardTransactionInfo(yellowcardTransactionRecord.id, toUpdateYC);
	} else {
		const toUpdateYC = {
			yellowcard_rfq_response: yellowcardRequestForQuote,
		}
		await updateYellowCardTransactionInfo(yellowcardTransactionRecord.id, toUpdateYC);
	}

	const result = await fetchYellowcardCryptoToFiatTransferRecord(initialTransferRecord.id, profileId);
	return { isExternalAccountExist: true, transferResult: result }
}

const acceptYellowcardCryptoToFiatTransfer = async (config) => {
	const { recordId, profileId } = config;

	// Fetch the offramp transaction record by recordId
	const { data: record, error: recordError } = await supabase
		.from("offramp_transactions")
		.select("*, yellowcard_transaction_info:yellowcard_transaction_id (*)")
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

	try {

		// Execute the exchange process, which returns status and additional data
		await executeYellowcardExchange(record);
		const result = await fetchYellowcardCryptoToFiatTransferRecord(record.id, profileId);
		return result;
	} catch (error) {
		console.error('Failed to process Yellowcard crypto to fiat transfer:', error);
		throw new Error(`Error processing transfer: ${error.message}`);
	}
};

module.exports = {
	createYellowcardCryptoToFiatTransfer,
	acceptYellowcardCryptoToFiatTransfer,
}