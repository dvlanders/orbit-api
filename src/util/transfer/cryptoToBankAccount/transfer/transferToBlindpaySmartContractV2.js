const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const { getBlindpayContractAddress } = require("../../../blindpay/blockchain");
const supabase = require("../../../supabaseClient");
const blindpayRailCheck = require("../railCheck/blindpayRailCheck");
const { getAddress, isAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const { CreateQuoteError, CreateQuoteErrorType } = require("../../../blindpay/errors");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { getFeeConfig } = require("../../fee/utils");
const { erc20Approve } = require("../../../bastion/utils/erc20FunctionMap");
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveTokenBastion");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount");
const { CryptoToFiatWithFeeBastion } = require("../../fee/CryptoToFiatWithFeeBastion");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const bastionGasCheck = require("../../../bastion/utils/gasCheck");
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck");
const { cryptoToFiatTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoToFiatTransfer/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { getMappedError } = require("../../../bastion/utils/errorMappings");
const { getBlindpayChain, getBlindpayToken } = require("../../../blindpay/blockchain");
const { createQuote } = require("../../../blindpay/endpoint/createQuote");
const fetchBlindpayCryptoToFiatTransferRecord = require("./fetchBlindpayCryptoToFiatTransferRecord");

const createAndApproveQuote = async (config) => {
    const {recordId, blindpayAccountId, chain, amount, sourceUserId, contractAddress, bastionRequestId} = config;

    let blindpayQuoteResponse;
    try{
        const quoteAmount = amount * 100; // 100 represents 1
        const network = getBlindpayChain(chain);
        const token = getBlindpayToken(); // Blindpay uses USDB for sandbox. USDC for production.
        blindpayQuoteResponse = await createQuote(blindpayAccountId, quoteAmount, network, token);
    }catch(error){
        if(error instanceof CreateQuoteError){
            await createLog("transfer/util/transferToBlindpaySmartContractV2/createAndApproveQuote", sourceUserId, error.message, error.rawResponse)
            await updateRequestRecord(recordId, {blindpay_quote_response: error.rawResponse})
        }else{
            await createLog("transfer/util/transferToBlindpaySmartContractV2/createAndApproveQuote", sourceUserId, error.message, error)
        }
        throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    }

    const conversionRate = {...blindpayQuoteResponse};
    delete conversionRate.contract;

    const abi = blindpayQuoteResponse.contract.abi;
    const approveFunctionAbi = abi.find(func => func.name === 'approve');
    const inputs = approveFunctionAbi.inputs;

    const actionParams = inputs.map(input => {
        const value = input.name.includes('spender')
          ? blindpayQuoteResponse.contract.blindpayContractAddress
          : input.name.includes('value')
          ? blindpayQuoteResponse.contract.amount
          : null;
      
        return {
          name: input.name,
          value: value
        };
      });

    const bodyObject = {
        requestId: bastionRequestId,
        userId: sourceUserId,
        contractAddress: contractAddress, // blindpayQuoteResponse.contract.address,
        actionName: blindpayQuoteResponse.contract.functionName,
        chain: chain === "POLYGON_AMOY" ? "BASE_SEPOLIA" : chain, 
        actionParams: actionParams
    };
    const response = await submitUserAction(bodyObject)
    const responseBody = await response.json();
    if (!response.ok) {
        // fail to transfer
        await createLog("transfer/util/transferToBlindpaySmartContractV2/createAndApproveQuote", sourceUserId, responseBody.message, responseBody)
        const { message, type } = getMappedError(responseBody.message)

        const toUpdate = {
            bastion_response: responseBody,
            bastion_transaction_status: "FAILED",
            transaction_status: "NOT_INITIATED",
            failed_reason: message,
            blindpay_quote_response: blindpayQuoteResponse,
            blindpay_quote_id: blindpayQuoteResponse.id,
            conversion_rate: conversionRate
        }

        const updatedRecord = await updateRequestRecord(recordId, toUpdate)
        throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    } else {
        const toUpdate = {
            bastion_response: responseBody,
            transaction_hash: responseBody.transactionHash,
            bastion_transaction_status: responseBody.status,
            transaction_status: responseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN",
            failed_reason: responseBody.failureDetails,
            blindpay_quote_response: blindpayQuoteResponse,
            blindpay_quote_id: blindpayQuoteResponse.id,
            conversion_rate: conversionRate
        }
        const updatedRecord = await updateRequestRecord(recordId, toUpdate)
        return updatedRecord
    }
}

const initTransferData = async (config) => {
    const { requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, sourceWalletType, destinationUserId, blindpayAccountId } = config

	const contractAddress = getBlindpayContractAddress(chain, sourceCurrency)

	//insert the initial record
	let { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.insert({
			request_id: requestId,
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			amount: amount,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			to_blindpay_account_id: blindpayAccountId,
			transaction_status: 'CREATED',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "BLINDPAY",
			crypto_provider: "BASTION",
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
			bastion_user_id: sourceUserId
		})
		.select()
		.single()

	if (recordError) {
		console.error('initialBastionTransfersInsertError', recordError);
		await createLog("transfer/util/transferToBlindpaySmartContract", sourceUserId, recordError.message)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

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
		const result = await fetchBlindpayCryptoToFiatTransferRecord(record.id, profileId)
		return result
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
		const result = await fetchBlindpayCryptoToFiatTransferRecord(record.id, profileId)
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
    if(!feeRecord) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Fee record not found")

    const clientReceivedAmount = (amount - feeRecord.fee_amount).toFixed(2)
    const config = {
        recordId: initialTransferRecord.id,
        blindpayAccountId: initialTransferRecord.to_blindpay_account_id,
        chain: chain,
        amount: clientReceivedAmount,
        sourceUserId: bastionUserId,
        contractAddress: initialTransferRecord.contract_address,
        bastionRequestId: initialTransferRecord.bastion_request_id
    }
    const updatedRecord = await createAndApproveQuote(config);
    // TODO: This is for Bridge, we need to fix it for Blindpay in the future when we want to allow Fee transfer
    const result = await CryptoToFiatWithFeeBastion(updatedRecord, feeRecord, paymentProcessorContractAddress, profileId)
    // gas check
    await bastionGasCheck(sourceUserId, chain, initialTransferRecord.transfer_from_wallet_type)
    await allowanceCheck(bastionUserId, sourceWalletAddress, chain, sourceCurrency)
    return { isExternalAccountExist: true, transferResult: result }
}

const transferWithoutFee = async (initialTransferRecord, profileId) => {
    const recordId = initialTransferRecord.id;
    const chain = initialTransferRecord.chain;
    const bastionUserId = initialTransferRecord.bastion_user_id
    
    const config = {
        recordId: recordId,
        blindpayAccountId: initialTransferRecord.to_blindpay_account_id,
        chain: chain,
        amount: initialTransferRecord.amount,
        sourceUserId: bastionUserId,
        contractAddress: initialTransferRecord.contract_address,
        bastionRequestId: initialTransferRecord.bastion_request_id
    }
    const updatedRecord = await createAndApproveQuote(config);
    // gas check
    await bastionGasCheck(bastionUserId, chain, initialTransferRecord.transfer_from_wallet_type)

    const result = await fetchBlindpayCryptoToFiatTransferRecord(recordId, profileId)
    return { isExternalAccountExist: true, transferResult: result }
}

const createTransferToBlindpaySmartContract = async (config) => {
    const { requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, sourceWalletType } = config
    if (amount < 10) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 10.")
    if (feeType || feeValue > 0) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Fee collection feature is not yet available for this route")
    const { isExternalAccountExist, blindpayAccountId, destinationUserId } = await blindpayRailCheck(destinationAccountId)
    if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }
	config.blindpayAccountId = blindpayAccountId
    config.destinationUserId = destinationUserId
    const initialTransferRecord = await initTransferData(config);
	// create Job
	const jobConfig = {
		recordId: initialTransferRecord.id
	}
	if (await cryptoToFiatTransferScheduleCheck("cryptoToFiatTransfer", jobConfig, sourceUserId, profileId)) {
		await createJob("cryptoToFiatTransfer", jobConfig, sourceUserId, profileId)
	}
	const result = await fetchBlindpayCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return { isExternalAccountExist: true, transferResult: result }
}

const executeAsyncBlindpayTransferCryptoToFiat = async (config) => {
	// fetch from created record
	const { data, error } = await supabase
		.from('offramp_transactions')
		.select("*")
		.eq("id", config.recordId)
		.single()

	if (error) {
		await createLog("transfer/util/executeAsyncBlindpayTransferCryptoToFiat", data.user_id, error.message, error)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	// transfer
	if (data.developer_fee_id) {
		return await transferWithFee(data, config.profileId)
	} else {
		return await transferWithoutFee(data, config.profileId)
	}

}

module.exports = {
	createTransferToBlindpaySmartContract,
	executeAsyncBlindpayTransferCryptoToFiat
}