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
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveToken");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
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
const { safeStringToFloat, safeSum } = require("../../../utils/number");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../utils/simulateSandboxCryptoToFiatTransaction");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { insertSingleOfframpTransactionRecord, updateOfframpTransactionRecord } = require("../utils/offrampTransactionsTableService");
const { transferToWallet, transferToWalletWithPP, insertWalletTransactionRecord, getWalletColumnNameFromProvider } = require("../../walletOperations/utils");
const { insertSingleBridgeTransactionRecord, updateBridgeTransactionRecord } = require("../../../bridge/bridgeTransactionTableService");
const { getUserWallet } = require("../../../user/getUserWallet");
const { updateFeeRecord } = require("../../fee/updateFeeRecord");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const initTransferData = async (config) => {
	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, paymentRail, sameDayAch, achReference, sepaReference, wireMessage, swiftReference, accountInfo, feeTransactionId, sourceWalletProvider, newRecord } = config
	// insert wallet provider record
	const toInsertProviderRecord = {
		user_id: sourceUserId,
		request_id: v4()
	}

	const walletProviderRecord = await insertWalletTransactionRecord(sourceWalletProvider, toInsertProviderRecord)

	// insert bridge transaction record
	const toInsertBridgeRecord = {
		user_id: sourceUserId,
		request_id: v4()
	}
	const bridgeRecord = await insertSingleBridgeTransactionRecord(toInsertBridgeRecord)

	// get conversion rate
	const conversionRate = await getBridgeConversionRate(sourceCurrency, destinationCurrency, profileId)
	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]
	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	const toInsertOfframpRecord = {
		user_id: sourceUserId,
		destination_user_id: destinationUserId,
		amount: amount,
		amount_include_developer_fee: amount,
		chain: chain,
		from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
		transaction_status: 'CREATED',
		contract_address: contractAddress,
		fiat_provider: "BRIDGE",
		crypto_provider: sourceWalletProvider,
		conversion_rate: conversionRate,
		source_currency: sourceCurrency,
		destination_currency: destinationCurrency,
		destination_account_id: destinationAccountId,
		transfer_from_wallet_type: sourceWalletType,
		same_day_ach: !!sameDayAch,
		ach_reference: achReference,
		sepa_reference: sepaReference,
		wire_message: wireMessage,
		swift_reference: swiftReference,
		billing_tags_success: billingTags.success,
		billing_tags_failed: billingTags.failed,
		fee_transaction_id: feeTransactionId,
		[getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id,
		bridge_transaction_record_id: bridgeRecord.id
	}
	const record = await updateOfframpTransactionRecord(newRecord.id, toInsertOfframpRecord)

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0) return record

	// insert fee record
	let { feePercent, feeAmount, clientReceivedAmount } = getFeeConfig(feeType, feeValue, amount)
	const info = {
		chargedUserId: sourceUserId,
		chain: chain,
		currency: sourceCurrency,
		chargedWalletAddress: sourceWalletAddress
	}
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, sourceWalletProvider, null, {[getWalletColumnNameFromProvider(sourceWalletProvider)]: walletProviderRecord.id})

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Amount after subtracting fee is less than valid amount for transfer`
		}
		record = await updateOfframpTransactionRecord(record.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(record.id, profileId)
		return result
	}

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${currency} on ${chain}`
		}
		record = await updateOfframpTransactionRecord(record.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(record.id, profileId)
		return result
	}

	// update into crypto to crypto table
	const amountIncludeDeveloperFee = parseFloat(safeSum([amount, feeAmount]).toFixed(2))
	const result = await updateOfframpTransactionRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress, amount_include_developer_fee: amountIncludeDeveloperFee })
	return result
}

const transferWithFee = async (initialTransferRecord, profileId) => {
	const paymentProcessorContractAddress = initialTransferRecord.payment_processor_contract_address
	const sourceUserId = initialTransferRecord.user_id
	const destinationAccountId = initialTransferRecord.destination_account_id
	const sourceCurrency = initialTransferRecord.source_currency
	const destinationCurrency = initialTransferRecord.destination_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const sourceWalletAddress = initialTransferRecord.from_wallet_address
	const walletType = initialTransferRecord.transfer_from_wallet_type
	const walletProvider = initialTransferRecord.crypto_provider
	const feeRecord = initialTransferRecord.feeRecord
	const { bastionUserId, circleWalletId } = await getUserWallet(sourceUserId, chain, walletType)

	// get account info
	const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
	if (!accountInfo || !accountInfo.account_id) throw new Error(`destinationAccountId not exist`)
	if (accountInfo.rail_type != "offramp") throw new Error(`destinationAccountId is not a offramp bank account`)

	const internalAccountId = accountInfo.account_id

	// TODO: determine if we still need bridgeRailCheck here. Could we just pass the interalAccountId and destinationCurrency to the destination object which we pass to createBridgeTransfer?
	//get payment rail
	const { destinationUserBridgeId, bridgeExternalAccountId } = await bridgeRailCheck(internalAccountId, destinationCurrency)

	// if initialTransferRecord.same_day_ach is true, use ach_same_day payment rail
	const paymentRail = initialTransferRecord.same_day_ach ? "ach_same_day" : accountInfo.payment_rail

	// Amount for ExactIn
	const clientReceivedAmount = (amount - feeRecord.fee_amount).toFixed(2)
	// Amount for ExactOut
	// const clientReceivedAmount = amount.toFixed(2)

	// create a bridge transfer
	const source = {
		currency: sourceCurrency,
		payment_rail: chainToVirtualAccountPaymentRail[chain],
		from_address: sourceWalletAddress
	}
	const destination = {
		currency: destinationCurrency,
		payment_rail: paymentRail,
		external_account_id: bridgeExternalAccountId
	}

	// if paymentRail is "wire" then we add wire_message to the destination object
	if (paymentRail == "wire") {
		destination.wire_message = initialTransferRecord.wire_message
		// destination.swift_reference = initialTransferRecord.swift_reference
	}

	// if the paymentrail is "sepa" then we attach sepa_reference to the destination object
	if (paymentRail == "sepa") {
		destination.sepa_reference = initialTransferRecord.sepa_reference
	}

	// if the paymentrail is "ach" or "ach_same_day" then we attach ach_reference to the destination object
	if (paymentRail == "ach" || paymentRail == "ach_same_day") {
		destination.ach_reference = initialTransferRecord.ach_reference
	}

	const {response: bridgeResponse, responseBody: bridgeResponseBody, failedReason: bridgeFailedReason, providerStatus: bridgeProviderStatus} = await createBridgeTransfer(initialTransferRecord.id, clientReceivedAmount, destinationUserBridgeId, source, destination, initialTransferRecord.bridge_transaction_record_id)
	if (!bridgeResponse.ok) {
		// failed to create tranfser
		await createLog("transfer/createTransferToBridgeLiquidationAddress", sourceUserId, bridgeResponseBody.message, bridgeResponseBody)
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			updated_at: new Date().toISOString(),
			failed_reason: bridgeFailedReason
		}
		const updatedRecord = await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(updatedRecord.id, profileId)
		return result
	}

	// update record
	const liquidationAddress = bridgeResponseBody.source_deposit_instructions.to_address
	const providerFee = safeStringToFloat(bridgeResponseBody.receipt.developer_fee) + safeStringToFloat(bridgeResponseBody.receipt.exchange_fee) + safeStringToFloat(bridgeResponseBody.receipt.gas_fee)
	const finalClientReceivedAmount = safeStringToFloat(bridgeResponseBody.receipt.final_amount || bridgeResponseBody.receipt.subtotal_amount) * parseFloat(initialTransferRecord.conversion_rate.conversionRate)
	let toUpdateOfframpRecord = {
		updated_at: new Date().toISOString(),
		provider_fee: providerFee,
		destination_currency_amount: finalClientReceivedAmount,
		to_wallet_address: isAddress(liquidationAddress) ? getAddress(liquidationAddress) : liquidationAddress
	}
	const updatedRecord = await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord)

	// initiate transfer to liquidation address with payment processor
	// fetch sender wallet information
    const feeCollectionWalletAddress = feeRecord.fee_collection_wallet_address
    const feeUnitsAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
    const unitsAmount = toUnitsString(amount, currencyDecimal[sourceCurrency]) 
    const providerRecordId = updatedRecord[getWalletColumnNameFromProvider(walletProvider)]

    // perfrom transfer with fee
    const transferConfig = {
        referenceId: updatedRecord.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: sourceCurrency, 
        unitsAmount, 
        chain, 
        destinationAddress: liquidationAddress, 
        transferType: transferType.CRYPTO_TO_FIAT,
        paymentProcessorContract: paymentProcessorContractAddress,
        feeUnitsAmount,
        feeCollectionWalletAddress,
        providerRecordId,
        paymentProcessType: "EXACT_IN"
    }

    const {response, responseBody, mainTableStatus, providerStatus, failedReason, feeRecordStatus} = await transferToWalletWithPP(walletProvider, transferConfig)

	// update offramp transaction record
	toUpdateOfframpRecord ={
        transaction_status: mainTableStatus,
        updated_at: new Date().toISOString(),
    }
    const toUpdateFeeRecord = {
        charged_status: feeRecordStatus,
        updated_at: new Date().toISOString(),
    }
    if (!response.ok) {
        await createLog("transfer/createTransferToBridgeLiquidationAddress", sourceUserId, responseBody.message, responseBody)
        toUpdateOfframpRecord.failed_reason = failedReason
        toUpdateFeeRecord.failed_reason = failedReason
    }
    await Promise.all([
        updateOfframpTransactionRecord(updatedRecord.id, toUpdateOfframpRecord),
        updateFeeRecord(feeRecord.id, toUpdateFeeRecord)
    ])

	const result = await fetchBridgeCryptoToFiatTransferRecord(updatedRecord.id, profileId)
	return result

}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
	const sourceUserId = initialTransferRecord.user_id
	const destinationAccountId = initialTransferRecord.destination_account_id
	const sourceCurrency = initialTransferRecord.source_currency
	const destinationCurrency = initialTransferRecord.destination_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const sourceWalletAddress = initialTransferRecord.from_wallet_address
	const walletType = initialTransferRecord.transfer_from_wallet_type
	const walletProvider = initialTransferRecord.crypto_provider
	const { bastionUserId, circleWalletId } = await getUserWallet(sourceUserId, chain, walletType)

	// get account info
	const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
	if (!accountInfo || !accountInfo.account_id) throw new Error(`destinationAccountId not exist`)
	if (accountInfo.rail_type != "offramp") throw new Error(`destinationAccountId is not a offramp bank account`)

	const bridgeExternalAccountRecordId = accountInfo.account_id
	// if initialTransferRecord.same_day_ach is true, use ach_same_day payment rail
	const paymentRail = initialTransferRecord.same_day_ach ? "ach_same_day" : accountInfo.payment_rail


	//get payment rail
	const { destinationUserBridgeId, bridgeExternalAccountId } = await bridgeRailCheck(bridgeExternalAccountRecordId, destinationCurrency)

	//create transfer without fee
	// create a bridge transfer
	const source = {
		currency: sourceCurrency,
		payment_rail: chainToVirtualAccountPaymentRail[chain],
		from_address: sourceWalletAddress
	}
	const destination = {
		currency: destinationCurrency,
		payment_rail: paymentRail,
		external_account_id: bridgeExternalAccountId
	}

	// if paymentRail is "wire" then we add wire_message to the destination object
	if (paymentRail == "wire") {
		destination.wire_message = initialTransferRecord.wire_message
	}

	// if the paymentrail is "sepa" then we attach sepa_reference to the destination object
	if (paymentRail == "sepa") {
		destination.sepa_reference = initialTransferRecord.sepa_reference
	}

	// if the paymentrail is "ach" or "ach_same_day" then we attach ach_reference to the destination object
	if (paymentRail == "ach" || paymentRail == "ach_same_day") {
		destination.ach_reference = initialTransferRecord.ach_reference
	}

	// this is for sandbox simulation
	if (process.env.NODE_ENV == "development") {
		const toUpdate = {
			updated_at: new Date().toISOString(),
			destination_currency_amount: amount,
			to_wallet_address: "0x0000000000000000000000000000000000000000",
			transaction_status: "COMPLETED",
			failed_reason: "This is a simulated success response for sandbox environment only."
		}

		await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate)
		await simulateSandboxCryptoToFiatTransactionStatus(initialTransferRecord)
		const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return result
	}

	const clientReceivedAmount = amount.toFixed(2)
	const {response: bridgeResponse, responseBody: bridgeResponseBody, failedReason: bridgeFailedReason, providerStatus: bridgeProviderStatus} = await createBridgeTransfer(initialTransferRecord.id, clientReceivedAmount, destinationUserBridgeId, source, destination, initialTransferRecord.bridge_transaction_record_id)
	if (!bridgeResponse.ok) {
		// failed to create tranfser
		await createLog("transfer/createTransferToBridgeLiquidationAddress", sourceUserId, bridgeResponseBody.message, bridgeResponseBody)
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			updated_at: new Date().toISOString(),
			failed_reason: bridgeFailedReason
		}
		const updatedRecord = await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(updatedRecord.id, profileId)
		return result
	}


	// update record
	const liquidationAddress = bridgeResponseBody.source_deposit_instructions.to_address
	const providerFee = safeStringToFloat(bridgeResponseBody.receipt.developer_fee) + safeStringToFloat(bridgeResponseBody.receipt.exchange_fee) + safeStringToFloat(bridgeResponseBody.receipt.gas_fee)
	const finalClientReceivedAmount = safeStringToFloat(bridgeResponseBody.receipt.final_amount || bridgeResponseBody.receipt.subtotal_amount) * parseFloat(initialTransferRecord.conversion_rate.conversionRate)
	let toUpdateOfframpRecord = {
		updated_at: new Date().toISOString(),
		provider_fee: providerFee,
		destination_currency_amount: finalClientReceivedAmount,
		to_wallet_address: isAddress(liquidationAddress) ? getAddress(liquidationAddress) : liquidationAddress
	}
	await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord)

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
        chain: chain, 
        destinationAddress: liquidationAddress, 
        transferType: transferType.CRYPTO_TO_FIAT,
        providerRecordId
	}
	const {response: walletResponse, responseBody: walletResponseBody, failedReason: walletFailedReason, providerStatus: walletProviderStatus, mainTableStatus} = await transferToWallet(walletProvider, transferConfig)

	// map status
	toUpdateOfframpRecord = {
		updated_at: new Date().toISOString(),
		transaction_status: mainTableStatus
	}
	if (!walletResponse.ok) {
		// fail to transfer
        await createLog("transfer/util/createTransferToBridgeLiquidationAddress", sourceUserId, walletResponseBody.message, walletResponseBody)
		toUpdateOfframpRecord.failed_reason = walletFailedReason
	}
	await updateOfframpTransactionRecord(initialTransferRecord.id, toUpdateOfframpRecord)
	const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return result
}

const createTransferToBridgeLiquidationAddress = async (config) => {
	const { sourceCurrency, chain, amount, profileId, sourceUserId } = config

	// fetch or insert request record
	const initialTransferRecord = await initTransferData(config)

	if(!await checkBalanceForTransactionFee(initialTransferRecord.id, transferType.CRYPTO_TO_FIAT)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Insufficient balance for transaction fee"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const result = fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }

	if(!await checkBalanceForTransactionAmount(sourceUserId, amount, chain, sourceCurrency)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const result = fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }

	// create Job
	const jobConfig = {
		recordId: initialTransferRecord.id
	}
	if (await cryptoToFiatTransferScheduleCheck("cryptoToFiatTransfer", jobConfig, sourceUserId, profileId)) {
		await createJob("cryptoToFiatTransfer", jobConfig, sourceUserId, profileId)
	}

	const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return { isExternalAccountExist: true, transferResult: result }
}

// this should already contain every information needed for transfer
const executeAsyncTransferCryptoToFiat = async (config) => {
	// fetch from created record
	const { data, error } = await supabase
		.from('offramp_transactions')
		.select("*, bridgeTransaction: bridge_transaction_record_id(id), feeRecord: developer_fee_id(*)")
		.eq("id", config.recordId)
		.single()

	if (error) {
		await createLog("transfer/util/createTransferToBridgeLiquidationAddress", sourceUserId, error.message)
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
	createTransferToBridgeLiquidationAddress,
	executeAsyncTransferCryptoToFiat
}