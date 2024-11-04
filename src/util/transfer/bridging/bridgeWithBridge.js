const { currencyContractAddress, currencyDecimal } = require("../../common/blockchain");
const supabase = require("../../supabaseClient");
const { getAddress, isAddress } = require("ethers");
const createLog = require("../../logger/supabaseLogger");
const { toUnitsString } = require("../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../utils/transfer");
const { getFeeConfig } = require("../fee/utils");
const { paymentProcessorContractMap } = require("../../smartContract/approve/approveToken");
const createJob = require("../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../fee/createNewFeeRecord");
const getBridgeConversionRate = require("../conversionRate/main/getBridgeCoversionRate");
const { v4 } = require("uuid");
const { chainToVirtualAccountPaymentRail, chainToBridgeChain, getBridgeUserId } = require("../../bridge/utils");
const createBridgeTransfer = require("../../bridge/endpoint/createTransfer");
const { fetchAccountProviders } = require("../../account/accountProviders/accountProvidersService");
const { safeStringToFloat, safeSum, safeToNumberString } = require("../../utils/number");
const { checkBalanceForTransactionFee } = require("../../billing/fee/transactionFeeBilling");
const { checkBalanceForTransactionAmount } = require("../../bastion/utils/balanceCheck");
const { getBillingTagsFromAccount } = require("../utils/getBillingTags");
const { transferToWallet, transferToWalletWithPP, insertWalletTransactionRecord, getWalletColumnNameFromProvider } = require("../walletOperations/utils");
const { insertSingleBridgeTransactionRecord, updateBridgeTransactionRecord } = require("../../bridge/bridgeTransactionTableService");
const { getUserWallet } = require("../../user/getUserWallet");
const { updateFeeRecord } = require("../fee/updateFeeRecord");
const { updateBridgingTransactionRecord, getBridgingTransactionRecord } = require("./bridgingTransactionTableService");
const fetchBridgingTransactions = require("./fetchBridgingTransactions");
const notifyBridgingUpdate = require("../../../../webhooks/bridging/notifyBridgingUpdate");
const { supabaseCall } = require("../../supabaseWithRetry");

const createBridgeTransferRequest = async (config) => {
    const { sourceCurrency, destinationCurrency, sourceChain, destinationChain, sourceWalletAddress, destinationWalletAddress, amount, recordId, sourceBridgeUserId, bridgeTransactionRecordId } = config
    const source = {
		currency: sourceCurrency,
		payment_rail: chainToBridgeChain[sourceChain],
		from_address: sourceWalletAddress
	}
	const destination = {
		currency: destinationCurrency,
		payment_rail: chainToBridgeChain[destinationChain],
        to_address: destinationWalletAddress
	}

    return await createBridgeTransfer(recordId, amount, sourceBridgeUserId, source, destination, bridgeTransactionRecordId)

}

const initTransferData = async (config) => {
	const { requestId, amount, sourceUserId, destinationUserId, sourceChain, destinationChain, sourceWalletAddress, destinationWalletAddress, newRecord, feeType, feeValue, sourceWalletType, destinationWalletType, sourceWalletProvider, destinationWalletProvider, sourceCurrency, destinationCurrency, profileId, feeTransactionId } = config
	// insert wallet provider record
	const toInsertProviderRecord = {
		user_id: sourceUserId,
		request_id: v4()
	}

	const walletProviderRecord = await insertWalletTransactionRecord(sourceWalletProvider, toInsertProviderRecord)

	// insert bridge transaction record
    const bridgeUserId = await getBridgeUserId(sourceUserId)
	const toInsertBridgeRecord = {
		user_id: sourceUserId,
		request_id: v4(),
        transfer_type: transferType.BRIDGE_ASSET
	}
	const bridgeRecord = await insertSingleBridgeTransactionRecord(toInsertBridgeRecord)
    const {failedReason, providerStatus, response, responseBody} = await createBridgeTransferRequest({ sourceCurrency, destinationCurrency, sourceChain, destinationChain, sourceWalletAddress, destinationWalletAddress, amount: safeToNumberString(amount), recordId: newRecord.id, sourceBridgeUserId: bridgeUserId, bridgeTransactionRecordId: bridgeRecord.id })
    const liquidationAddress = responseBody.source_deposit_instructions?.to_address
	// get billing tags
    const billingTags = destinationUserId ? {
        success: destinationUserId == sourceUserId ? [] : ["internal"],
        failed: [],
    } : {
        success: ["external"],
        failed: [""],
    }
    const amountChecked = safeStringToFloat(safeToNumberString(amount))
	//insert the initial record
	const toUpdateBridgingRecord = {
		source_user_id: sourceUserId,
		destination_user_id: destinationUserId,
		amount: amountChecked,
		amount_include_developer_fee: amountChecked,
        source_currency: sourceCurrency,
        destination_currency: destinationCurrency,
		source_chain: sourceChain,
        destination_chain: destinationChain,
        source_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
        destination_wallet_address: isAddress(destinationWalletAddress) ? getAddress(destinationWalletAddress) : destinationWalletAddress,
        source_wallet_type: sourceWalletType,
        destination_wallet_type: destinationWalletType,
        bridge_transaction_record_id: bridgeRecord.id,
        [getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id,
        source_wallet_provider: sourceWalletProvider,
        destination_wallet_provider: destinationWalletProvider,
        billing_tags_success: billingTags.success,
        billing_tags_failed: billingTags.failed,
        bridge_provider: "BRIDGE",
        status: "OPEN_QUOTE",
        liquidation_address: liquidationAddress,
        fee_transaction_id: feeTransactionId
	}
    if (!response.ok) {
        toUpdateBridgingRecord.status = "QUOTE_FAILED"
        toUpdateBridgingRecord.failed_reason = failedReason
    }

	const record = await updateBridgingTransactionRecord(newRecord.id, toUpdateBridgingRecord)

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0 || !response.ok) return record

	// insert fee record
	let { feePercent, feeAmount, clientReceivedAmount } = getFeeConfig(feeType, feeValue, amount)
	const info = {
		chargedUserId: sourceUserId,
		chain: chain,
		currency: sourceCurrency,
		chargedWalletAddress: sourceWalletAddress
	}
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.BRIDGE_ASSET, sourceWalletProvider, null, {[getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id})

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			status: "NOT_INITIATED",
			failed_reason: `Amount is less than valid amount for transfer`
		}
		record = await updateBridgingTransactionRecord(record.id, toUpdate)
		const result = await fetchBridgingTransactions(record.id, profileId)
		return result
	}

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][sourceChain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${sourceCurrency} on ${chain}`
		}
		record = await updateBridgingTransactionRecord(record.id, toUpdate)
		const result = await fetchBridgingTransactions(record.id, profileId)
		return result
	}

	// update into crypto to crypto table
	const amountIncludeDeveloperFee = safeStringToFloat(safeSum([amount, feeAmount]).toFixed(2))
	const result = await updateBridgingTransactionRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress, amount_include_developer_fee: amountIncludeDeveloperFee })
	return result
}

const transferWithFee = async (initialTransferRecord, profileId) => {
	const paymentProcessorContractAddress = initialTransferRecord.payment_processor_contract_address
	const sourceUserId = initialTransferRecord.source_user_id
	const sourceCurrency = initialTransferRecord.source_currency
	const sourceChain = initialTransferRecord.source_chain
	const amount = initialTransferRecord.amount
	const sourceWalletType = initialTransferRecord.source_wallet_type
	const feeRecord = initialTransferRecord.feeRecord
	const { bastionUserId, circleWalletId, walletProvider } = await getUserWallet(sourceUserId, sourceChain, sourceWalletType)

	// initiate transfer to liquidation address with payment processor
	// fetch sender wallet information
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
        chain: sourceChain, 
        destinationAddress: initialTransferRecord.liquidation_address, 
        transferType: transferType.BRIDGE_ASSET,
        paymentProcessorContract: paymentProcessorContractAddress,
        feeUnitsAmount,
        feeCollectionWalletAddress,
        providerRecordId,
        paymentProcessType: "EXACT_OUT"
    }

    const {response, responseBody, mainTableStatus, providerStatus, failedReason, feeRecordStatus} = await transferToWalletWithPP(walletProvider, transferConfig)

	// update offramp transaction record
	const toUpdateBridgingRecord ={
        status: mainTableStatus,
        updated_at: new Date().toISOString(),
    }
    const toUpdateFeeRecord = {
        charged_status: feeRecordStatus,
        updated_at: new Date().toISOString(),
    }
    if (!response.ok) {
        await createLog("transfer/bridging/transferWithFee", sourceUserId, responseBody.message, responseBody)
        toUpdateBridgingRecord.failed_reason = failedReason
        toUpdateFeeRecord.failed_reason = failedReason
    }
    await Promise.all([
        updateBridgingTransactionRecord(initialTransferRecord.id, toUpdateBridgingRecord),
        updateFeeRecord(feeRecord.id, toUpdateFeeRecord)
    ])

	const result = await fetchBridgingTransactions(initialTransferRecord.id, profileId)
	return result

}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
	const sourceUserId = initialTransferRecord.source_user_id
	const sourceCurrency = initialTransferRecord.source_currency
	const destinationCurrency = initialTransferRecord.destination_currency
	const sourceChain = initialTransferRecord.source_chain
	const amount = initialTransferRecord.amount
	const sourceWalletType = initialTransferRecord.source_wallet_type
	const { bastionUserId, circleWalletId, walletProvider } = await getUserWallet(sourceUserId, sourceChain, sourceWalletType)


	// this is for sandbox simulation
	if (process.env.NODE_ENV == "development") {
		const toUpdate = {
			updated_at: new Date().toISOString(),
			status: "COMPLETED",
			failed_reason: "This is a simulated success response for sandbox environment only."
		}

		await updateBridgingTransactionRecord(initialTransferRecord.id, toUpdate)
		const result = await fetchBridgingTransactions(initialTransferRecord.id, profileId)
		return result
	}

	// update record
	const liquidationAddress = initialTransferRecord.liquidation_address

	// initiate transfer to liquidation address
	const decimals = currencyDecimal[sourceCurrency]
	const transferAmount = toUnitsString(amount, decimals)
	const providerRecordId = initialTransferRecord[getWalletColumnNameFromProvider(walletProvider)]
	const transferConfig = {
		referenceId: initialTransferRecord.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: sourceCurrency, 
        unitsAmount: transferAmount, 
        chain: sourceChain, 
        destinationAddress: liquidationAddress, 
        transferType: transferType.BRIDGE_ASSET,
        providerRecordId
	}
	const {response: walletResponse, responseBody: walletResponseBody, failedReason: walletFailedReason, providerStatus: walletProviderStatus, mainTableStatus} = await transferToWallet(walletProvider, transferConfig)

	// map status
	const toUpdateBridgingRecord = {
		updated_at: new Date().toISOString(),
		status: mainTableStatus
	}
	if (!walletResponse.ok) {
		// fail to transfer
        await createLog("transfer/bridging/transferWithoutFee", sourceUserId, walletResponseBody.message, walletResponseBody)
		toUpdateBridgingRecord.failed_reason = walletFailedReason
	}
	await updateBridgingTransactionRecord(initialTransferRecord.id, toUpdateBridgingRecord)
	const result = await fetchBridgingTransactions(initialTransferRecord.id, profileId)
	return result
}

const createBridgeBridging = async (config) => {
	const { sourceCurrency, sourceChain, amount, profileId, sourceUserId } = config

	// fetch or insert request record
	const initialTransferRecord = await initTransferData(config)

	const result = await fetchBridgingTransactions(initialTransferRecord.id, profileId)
	return result
}

// this should already contain every information needed for transfer
const executeBridgeBridging = async (config) => {
	// fetch from created record
	const {data: record, error} = await supabaseCall(() => supabase
		.from('bridging_transactions')
		.select('*, feeRecord:developer_fee_record_id(*)')
		.eq('id', config.recordId)
		.single()
	)

	if (!record) {
		await createLog("transfer/util/executeAsyncTransferBridgeBridging", sourceUserId, "No record found")
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	// transfer
	let receipt
	if (record.developer_fee_id) {
		receipt = await transferWithFee(record, config.profileId)
	} else {
		receipt = await transferWithoutFee(record, config.profileId)
	}
	// notify user
	await notifyBridgingUpdate(record)
	return receipt

}

const acceptBridgeBridging = async (config) => {
	const { recordId, profileId } = config;
	let sourceUserId
	try {
        const record = await getBridgingTransactionRecord(recordId)
        const amount = record.amount
        const amountIncludingFee = record.amount_include_developer_fee
        const sourceChain = record.source_chain
        const sourceCurrency = record.source_currency
        const sourceUserId = record.source_user_id

		// check if balance is enough for transaction fee
		if (!await checkBalanceForTransactionFee(record.id, transferType.BRIDGE_ASSET)) {
			const toUpdate = {
				status: "NOT_INITIATED",
				failed_reason: "Insufficient balance for transaction fee"
			}
			await updateBridgingTransactionRecord(recordId, toUpdate);
			const result = fetchBridgingTransactions(recordId, profileId);
			return result
		}

		// check if balance is enough for transaction amount
		const amountToCheck = Math.max(amount, amountIncludingFee)
		if(!await checkBalanceForTransactionAmount(sourceUserId, amountToCheck, sourceChain, sourceCurrency)){
			const toUpdate = {
				status: "NOT_INITIATED",
				failed_reason: "Transfer amount exceeds wallet balance"
			}
			await updateBridgingTransactionRecord(recordId, toUpdate)
			const result = await fetchBridgingTransactions(recordId, profileId)
			return result
		}

		// create job
		const jobConfig = {
			recordId,
		}
		await createJob("bridgeAsset", jobConfig, sourceUserId, profileId)

		// update offramp transaction record
		const toUpdateBridgingRecord = {
			status: "CREATED",
			updated_at: new Date().toISOString()
		}
		await updateBridgingTransactionRecord(recordId, toUpdateBridgingRecord)

		const result = await fetchBridgingTransactions(recordId, profileId);
		return result;

	} catch (error) {
		await createLog("transfer/bridging/acceptBridgeBridgingCryptoToFiatTransfer", sourceUserId, error.message, error)
		throw new Error(`Error processing transfer: ${error.message}`);
	}
};

module.exports = {
	createBridgeBridging,
	executeBridgeBridging,
	acceptBridgeBridging,
}