const { currencyContractAddress } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const bridgeRailCheck = require("../railCheck/bridgeRailCheckV2");
const { getAddress, isAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { transferType } = require("../../utils/transfer");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { CryptoToFiatWithFeeBastion } = require("../../fee/CryptoToFiatWithFeeBastion");
const createJob = require("../../../../../asyncJobs/createJob");
const getBridgeConversionRate = require("../../conversionRate/main/getBridgeCoversionRate");
const { v4 } = require("uuid");
const fetchBridgeCryptoToFiatTransferRecord = require("./fetchBridgeCryptoToFiatTransferRecordV2");
const { chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const createBridgeTransfer = require("../../../bridge/endpoint/createTransfer");
const { fetchAccountProviders } = require("../../../account/accountProviders/accountProvidersService");
const { safeStringToFloat } = require("../../../utils/number");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { burnUSDHIFI } = require("../../../smartContract/sandboxUSDHIFI/burn");
const { FetchCryptoToBankSupportedPairCheck } = require("../utils/cryptoToBankSupportedPairFetchFunctions");
const getReapExchangeRate = require("../../conversionRate/main/getReapExchangeRate");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { insertWalletTransactionRecord } = require("../../walletOperations/utils");
const { safeParseBody } = require("../../../utils/response");
const { updateOfframpTransactionRecord } = require("../utils/offrampTransactionsTableService");
const { updateBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService");
const { statusMapBastion } = require("../../walletOperations/bastion/statusMap");

const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'

const getExchangeRate = async (userId, profileId,toCurrency) => {
    if (toCurrency == "usd" || toCurrency == "eur") {
        const conversionRate = await getBridgeConversionRate("usdc", toCurrency, profileId)
        return conversionRate.conversionRate
    } else if (toCurrency == "hkd") {
        const responseBody = await getReapExchangeRate(userId, "usdc", toCurrency)
        return responseBody.exchangeRate
    } else if (toCurrency == "brl") {
        //FIXME
        return 5.6
    } else if (toCurrency == "kes") {
        return 128
    } else if (toCurrency == "ngn") {
        return 1620
    }
}


const initTransferData = async (config) => {
	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, sourceWalletType, feeType, feeValue, paymentRail, sameDayAch, achReference, sepaReference, wireMessage, swiftReference, accountInfo, feeTransactionId, sourceWalletProvider, newRecord, fiatProvider } = config
	// insert wallet provider record
	const toInsertWalletProviderRecord = {
		user_id: sourceUserId,
		request_id: v4(),
		bastion_user_id: gasStation
	}
	const walletProviderRecord = await insertWalletTransactionRecord("BASTION", toInsertWalletProviderRecord)

	// get conversion rate
	// get USDHIFI conversion rate
	const conversionRate = {
        fromCurrency: sourceCurrency,
        toCurrency: destinationCurrency,
        conversionRate: await getExchangeRate(sourceUserId, profileId, destinationCurrency),
        validFrom: new Date().toISOString(),
        validUntil: new Date().toISOString()
    }
	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]
	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	const toInsertOfframpRecord = {
		user_id: sourceUserId,
		destination_user_id: destinationUserId,
		amount: amount,
		chain: chain,
		from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
		transaction_status: 'CREATED',
		contract_address: contractAddress,
		fiat_provider: fiatProvider,
		crypto_provider: "BASTION",
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
		bastion_transaction_record_id: walletProviderRecord.id
	}
	const record = await updateOfframpTransactionRecord(newRecord.id, toInsertOfframpRecord)

	// return if no fee charged
	if (!feeType || parseFloat(feeValue) <= 0) return record
}

// not allowed in sandbox
const transferWithFee = async (initialTransferRecord, profileId) => {

	const sourceUserId = initialTransferRecord.user_id
	const destinationAccountId = initialTransferRecord.destination_account_id
	const sourceCurrency = initialTransferRecord.source_currency
	const destinationCurrency = initialTransferRecord.destination_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
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

	// create a bridge transfer
	const clientReceivedAmount = (amount - feeRecord.fee_amount).toFixed(2)
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
		destination.swift_reference = initialTransferRecord.swift_reference
	}

	// if the paymentrail is "sepa" then we attach sepa_reference to the destination object
	if (paymentRail == "sepa") {
		destination.sepa_reference = initialTransferRecord.sepa_reference
	}

	// if the paymentrail is "ach" or "ach_same_day" then we attach ach_reference to the destination object
	if (paymentRail == "ach" || paymentRail == "ach_same_day") {
		destination.ach_reference = initialTransferRecord.ach_reference
	}

	const response = await createBridgeTransfer(initialTransferRecord.id, clientReceivedAmount, destinationUserBridgeId, source, destination)
	const responseBody = await response.json()
	if (!response.ok) {
		// failed to create tranfser
		await createLog("transfer/createTransferToBridgeLiquidationAddress", sourceUserId, responseBody.message, responseBody)
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			updated_at: new Date().toISOString(),
			bridge_response: responseBody,
			failed_reason: "Please contact HIFI for more information"
		}
		const updatedRecord = await updateRequestRecord(initialTransferRecord.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return result
	}

	// update record
	const liquidationAddress = responseBody.source_deposit_instructions.to_address
	const providerFee = safeStringToFloat(responseBody.receipt.developer_fee) + safeStringToFloat(responseBody.receipt.exchange_fee) + safeStringToFloat(responseBody.receipt.gas_fee)
	const finalClientReceivedAmount = safeStringToFloat(responseBody.receipt.final_amount || responseBody.receipt.subtotal_amount) * parseFloat(initialTransferRecord.conversion_rate.conversionRate)
	const toUpdate = {
		updated_at: new Date().toISOString(),
		bridge_transaction_status: responseBody.state,
		bridge_response: responseBody,
		bridge_transfer_id: responseBody.id,
		provider_fee: providerFee,
		destination_currency_amount: finalClientReceivedAmount,
		to_wallet_address: isAddress(liquidationAddress) ? getAddress(liquidationAddress) : liquidationAddress
	}
	const updatedRecord = await updateRequestRecord(initialTransferRecord.id, toUpdate)
	const result = await CryptoToFiatWithFeeBastion(updatedRecord, feeRecord, paymentProcessorContractAddress, profileId)
	return result

}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
	const sourceUserId = initialTransferRecord.user_id
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const sourceWalletAddress = initialTransferRecord.from_wallet_address
	const bastionRequestId = initialTransferRecord.bastionTransaction.request_id

	// call burn function
    const bastionResponse = await burnUSDHIFI(sourceWalletAddress, amount, chain, bastionRequestId)	
	const bastionResponseBody = await safeParseBody(bastionResponse)

	// map status
	if (!bastionResponse.ok) {
		// dafault to not enough balance
		// fail to transfer
		await createLog("transfer/util/createSandboxCryptoToFiatTransfer/transferWithoutFee", sourceUserId, bastionResponseBody.message, bastionResponseBody)
		// const { message, type } = getMappedError(bastionResponseBody.message)

		const toUpdateBastionTransactionRecord = {
			bastion_status: "NOT_INITIATED",
			bastion_response: bastionResponseBody
		}

		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Transfer amount exceeds balance."
		}

		await Promise.all([	
			updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate),
			updateBastionTransactionRecord(initialTransferRecord.bastionTransaction.id, toUpdateBastionTransactionRecord)
		])
	} else {
		const mainTableStatus = statusMapBastion.CRYPTO_TO_FIAT[bastionResponseBody.status]
		const toUpdateBastionTransactionRecord = {
			bastion_status: bastionResponseBody.status,
			bastion_response: bastionResponseBody
		}
		const toUpdate = {
			transaction_status: mainTableStatus || "UNKNOWN",
			failed_reason: bastionResponseBody.failureDetails,
		}
		await Promise.all([	
			updateOfframpTransactionRecord(initialTransferRecord.id, toUpdate),
			updateBastionTransactionRecord(initialTransferRecord.bastionTransaction.id, toUpdateBastionTransactionRecord)
		])
	}

}


const createSandboxCryptoToFiatTransfer = async (config) => {
	const { destinationAccountId, amount, profileId, sourceUserId, sourceBastionUserId, chain, sourceCurrency, feeTransactionId } = config

	if (amount < 1) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
    
    // get account info and provider
	const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
	if (!accountInfo || !accountInfo.account_id) return { isExternalAccountExist: false, transferResult: null }
    config.fiatProvider = accountInfo.provider

	// fetch or insert request record
	const initialTransferRecord = await initTransferData({ ...config, accountInfo })

    if(!await checkBalanceForTransactionAmount(sourceBastionUserId, amount, chain, sourceCurrency)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const func = FetchCryptoToBankSupportedPairCheck(initialTransferRecord.crypto_provider, initialTransferRecord.fiat_provider)
		const result = await func(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }	

	// create Job
	const jobConfig = {
		recordId: initialTransferRecord.id
	}
	await createJob("cryptoToFiatTransferSandbox", jobConfig, sourceUserId, profileId)

    const func = FetchCryptoToBankSupportedPairCheck(initialTransferRecord.crypto_provider, initialTransferRecord.fiat_provider)
    const result = await func(initialTransferRecord.id, profileId)

	return { isExternalAccountExist: true, transferResult: result }
}

// this should already contain every information needed for transfer
const executeSandboxAsyncTransferCryptoToFiat = async (config) => {
	// fetch from created record
	const { data, error } = await supabase
		.from('offramp_transactions')
		.select("*, bastionTransaction:bastion_transaction_record_id(*)")
		.eq("id", config.recordId)
		.single()

	if (error) {
		await createLog("transfer/util/executeSandboxAsyncTransferCryptoToFiat", sourceUserId, error.message)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	// transfer
	if (data.developer_fee_id) {
		await transferWithFee(data, config.profileId)
	} else {
		await transferWithoutFee(data, config.profileId)
	}
	// send webhook message in production
	await notifyCryptoToFiatTransfer(data)

}

module.exports = {
    createSandboxCryptoToFiatTransfer,
    executeSandboxAsyncTransferCryptoToFiat
}
