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
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../utils/simulateSandboxCryptoToFiatTransaction");
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const initTransferData = async (config) => {
	const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, createdRecordId, sourceWalletType, bridgeExternalAccountId, feeType, feeValue, sourceBastionUserId, paymentRail, sameDayAch, achReference, sepaReference, wireMessage, swiftReference, accountInfo, feeTransactionId } = config



	// get conversion rate
	const conversionRate = await getBridgeConversionRate(sourceCurrency, destinationCurrency, profileId)
	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	let { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.update({
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			amount: amount,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			to_bridge_external_account_id: bridgeExternalAccountId, // actual id that bridge return to us
			transaction_status: 'CREATED',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "BRIDGE",
			crypto_provider: "BASTION",
			conversion_rate: conversionRate,
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
			bastion_user_id: sourceBastionUserId,
			same_day_ach: !!sameDayAch,
			ach_reference: achReference,
			sepa_reference: sepaReference,
			wire_message: wireMessage,
			swift_reference: swiftReference,
			billing_tags_success: billingTags.success,
			billing_tags_failed: billingTags.failed,
			fee_transaction_id: feeTransactionId
		})
		.eq("request_id", requestId)
		.select()
		.single()

	if (recordError) throw recordError

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
	const feeRecord = await createNewFeeRecord(record.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, "BASTION", record.request_id)

	// return if amount is less than 1 dollar
	if (clientReceivedAmount < 1) {
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Amount after subtracting fee is less than 1 dollar`
		}
		record = await updateRequestRecord(record.id, toUpdate)
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
		record = await updateRequestRecord(record.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(record.id, profileId)
		return result
	}

	// update into crypto to crypto table
	const result = await updateRequestRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress })
	return result
}

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
	const destinationAccountId = initialTransferRecord.destination_account_id
	const sourceCurrency = initialTransferRecord.source_currency
	const destinationCurrency = initialTransferRecord.destination_currency
	const chain = initialTransferRecord.chain
	const amount = initialTransferRecord.amount
	const sourceWalletAddress = initialTransferRecord.from_wallet_address
	const bastionUserId = initialTransferRecord.bastion_user_id

	// get account info
	const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
	if (!accountInfo || !accountInfo.account_id) throw new Error(`destinationAccountId not exist`)
	if (accountInfo.rail_type != "offramp") throw new Error(`destinationAccountId is not a offramp bank account`)

	const internalAccountId = accountInfo.account_id
	// if initialTransferRecord.same_day_ach is true, use ach_same_day payment rail
	const paymentRail = initialTransferRecord.same_day_ach ? "ach_same_day" : accountInfo.payment_rail


	//get payment rail
	const { destinationUserBridgeId, bridgeExternalAccountId } = await bridgeRailCheck(internalAccountId, destinationCurrency)

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

		await updateRequestRecord(initialTransferRecord.id, toUpdate)
		await simulateSandboxCryptoToFiatTransactionStatus(initialTransferRecord)
		const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return result
	}



	const clientReceivedAmount = amount.toFixed(2)
	const bridgeResponse = await createBridgeTransfer(initialTransferRecord.id, clientReceivedAmount, destinationUserBridgeId, source, destination)
	const bridgeResponseBody = await bridgeResponse.json()
	if (!bridgeResponse.ok) {
		// failed to create tranfser
		await createLog("transfer/createTransferToBridgeLiquidationAddress", sourceUserId, bridgeResponseBody.message, bridgeResponseBody)
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			updated_at: new Date().toISOString(),
			bridge_response: bridgeResponseBody,
			failed_reason: "Please contact HIFI for more information"
		}
		const updatedRecord = await updateRequestRecord(initialTransferRecord.id, toUpdate)
		const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return result
	}

	// update record
	const liquidationAddress = bridgeResponseBody.source_deposit_instructions.to_address
	const providerFee = safeStringToFloat(bridgeResponseBody.receipt.developer_fee) + safeStringToFloat(bridgeResponseBody.receipt.exchange_fee) + safeStringToFloat(bridgeResponseBody.receipt.gas_fee)
	const finalClientReceivedAmount = safeStringToFloat(bridgeResponseBody.receipt.final_amount || bridgeResponseBody.receipt.subtotal_amount) * parseFloat(initialTransferRecord.conversion_rate.conversionRate)
	const toUpdate = {
		updated_at: new Date().toISOString(),
		bridge_transaction_status: bridgeResponseBody.state,
		bridge_response: bridgeResponseBody,
		bridge_transfer_id: bridgeResponseBody.id,
		provider_fee: providerFee,
		destination_currency_amount: finalClientReceivedAmount,
		to_wallet_address: isAddress(liquidationAddress) ? getAddress(liquidationAddress) : liquidationAddress
	}
	await updateRequestRecord(initialTransferRecord.id, toUpdate)

	const decimals = currencyDecimal[sourceCurrency]
	const transferAmount = toUnitsString(amount, decimals)
	const bodyObject = {
		requestId: initialTransferRecord.bastion_request_id,
		userId: bastionUserId,
		contractAddress: initialTransferRecord.contract_address,
		actionName: "transfer",
		chain: chain,
		actionParams: erc20Transfer(sourceCurrency, chain, liquidationAddress, transferAmount)
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

		await updateRequestRecord(initialTransferRecord.id, toUpdate)

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

	const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return result
}

const createTransferToBridgeLiquidationAddress = async (config) => {
	const { destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceUserId, achReference, sepaReference, wireMessage, swiftReference, sourceBastionUserId, feeTransactionId } = config

	// use the destinationAccountId to get the internalAccountId so we can pass the internalAccountId to the bridgeRailCheck function
	// We should do a holistic refactor of the usage of bridgeRailCheck and fetchAccountProviders to simplify the code
	const accountInfo = await fetchAccountProviders(destinationAccountId, profileId)
	if (!accountInfo || !accountInfo.account_id) return { isExternalAccountExist: false, transferResult: null }

	// check destination bank account information
	const { isExternalAccountExist, destinationUserBridgeId, bridgeExternalAccountId, destinationUserId } = await bridgeRailCheck(accountInfo.account_id, destinationCurrency)
	config.destinationUserId = destinationUserId
	config.destinationUserBridgeId = destinationUserBridgeId
	config.bridgeExternalAccountId = bridgeExternalAccountId
	if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }

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

	if(!await checkBalanceForTransactionAmount(sourceBastionUserId, amount, chain, sourceCurrency)){
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
		.select("*")
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