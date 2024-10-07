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
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck");
const { cryptoToFiatTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoToFiatTransfer/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { getMappedError } = require("../../../bastion/utils/errorMappings");
const { getBlindpayChain, getBlindpayToken } = require("../../../blindpay/blockchain");
const { createQuote } = require("../../../blindpay/endpoint/createQuote");
const fetchBlindpayCryptoToFiatTransferRecord = require("./fetchBlindpayCryptoToFiatTransferRecord");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");

const createPaymentQuote = async (config) => {
    const {recordId, blindpayAccountId, chain, amount, sourceUserId, contractAddress, bastionRequestId} = config;

    let blindpayQuoteResponse;
    try{
        const quoteAmount = amount * 100; // 100 represents 1
        const network = getBlindpayChain(chain);
        const token = getBlindpayToken(); // Blindpay uses USDB for sandbox. USDC for production.
        blindpayQuoteResponse = await createQuote(blindpayAccountId, quoteAmount, network, token);
    }catch(error){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Quote creation failed, please contact HIFI for more information"
        }
        if(error instanceof CreateQuoteError){
            await createLog("transfer/util/transferToBlindpaySmartContractV2/createPaymentQuote", sourceUserId, error.message, error.rawResponse)
            toUpdate.blindpay_quote_response = error.rawResponse;
        }else{
            await createLog("transfer/util/transferToBlindpaySmartContractV2/createPaymentQuote", sourceUserId, error.message, error)
        }
        await updateRequestRecord(recordId, toUpdate);
        throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    }

    return blindpayQuoteResponse;

}

const acceptPaymentQuote = async (config) => {
    const {recordId, blindpayQuoteContract, bastionRequestId, sourceUserId, contractAddress, chain} = config;

    const abi = blindpayQuoteContract.abi;
    const approveFunctionAbi = abi.find(func => func.name === 'approve');
    const inputs = approveFunctionAbi.inputs;

    const actionParams = inputs.map(input => {
        const value = input.name.includes('spender')
          ? blindpayQuoteContract.blindpayContractAddress
          : input.name.includes('value')
          ? blindpayQuoteContract.amount
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
        actionName: blindpayQuoteContract.functionName,
        chain: chain === "POLYGON_AMOY" ? "BASE_SEPOLIA" : chain, 
        actionParams: actionParams
    };
    const response = await submitUserAction(bodyObject)
    const responseBody = await response.json();
    if (!response.ok) {
        // fail to transfer
        await createLog("transfer/util/transferToBlindpaySmartContractV2/acceptPaymentQuote", sourceUserId, responseBody.message, responseBody)
        const { message, type } = getMappedError(responseBody.message)

        const toUpdate = {
            bastion_response: responseBody,
            bastion_transaction_status: "FAILED",
            transaction_status: "QUOTE_FAILED",
            failed_reason: message,
        }
        
        const updatedRecord = await updateRequestRecord(recordId, toUpdate)
        return updatedRecord
    } else {
        const toUpdate = {
            bastion_response: responseBody,
            transaction_hash: responseBody.transactionHash,
            bastion_transaction_status: responseBody.status,
            transaction_status: responseBody.status == "FAILED" ? "QUOTE_FAILED" : "SUBMITTED_ONCHAIN",
            failed_reason: responseBody.failureDetails,
        }
        const updatedRecord = await updateRequestRecord(recordId, toUpdate)
        return updatedRecord
    }
    
}

const initTransferData = async (config) => {
    const { requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, sourceBastionUserId, sourceWalletType, blindpayAccountId, accountInfo, feeTransactionId } = config

	const contractAddress = getBlindpayContractAddress(chain, sourceCurrency)

	// get billing tags
	const billingTags = await getBillingTagsFromAccount(requestId, transferType.CRYPTO_TO_FIAT, sourceUserId, accountInfo)

	//insert the initial record
	const { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.update({
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			amount: amount,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			to_blindpay_account_id: blindpayAccountId,
			transaction_status: 'OPEN_QUOTE',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "BLINDPAY",
			crypto_provider: "BASTION",
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
			bastion_user_id: sourceBastionUserId,
			billing_tags_success: billingTags.success,
			billing_tags_failed: billingTags.failed,
            fee_transaction_id: feeTransactionId
		})
		.eq("request_id", requestId)
		.select()
		.single()

	if (recordError) {
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened", recordError)
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
		return await updateRequestRecord(record.id, toUpdate)
	}

	// get payment processor contract
	const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
	if (!paymentProcessorContractAddress) {
		// no paymentProcessorContract available
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			failed_reason: `Fee feature not available for ${sourceCurrency} on ${chain}`
		}
		return await updateRequestRecord(record.id, toUpdate)
	}

	// update into crypto to crypto table
	return await updateRequestRecord(record.id, { developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress })
}

// This function is not used in the current implementation
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

    const paymentConfig = {
        recordId: initialTransferRecord.id, 
        blindpayQuoteContract: initialTransferRecord.blindpay_quote_response?.contract, 
        bastionRequestId: initialTransferRecord.bastion_request_id, 
        sourceUserId: bastionUserId, 
        contractAddress: initialTransferRecord.contract_address, 
        chain: chain
    }
    const updatedRecord = await acceptPaymentQuote(paymentConfig)
    // TODO: This is for Bridge, we need to fix it for Blindpay in the future when we want to allow Fee transfer
    const result = await CryptoToFiatWithFeeBastion(updatedRecord, feeRecord, paymentProcessorContractAddress, profileId)
    return { isExternalAccountExist: true, transferResult: result }
}

// This function is not used in the current implementation
const transferWithoutFee = async (initialTransferRecord, profileId) => {
    const recordId = initialTransferRecord.id;
    const chain = initialTransferRecord.chain;
    const bastionUserId = initialTransferRecord.bastion_user_id
    
    const paymentConfig = {
        recordId, 
        blindpayQuoteContract: initialTransferRecord.blindpay_quote_response?.contract, 
        bastionRequestId: initialTransferRecord.bastion_request_id, 
        sourceUserId: bastionUserId, 
        contractAddress: initialTransferRecord.contract_address, 
        chain: initialTransferRecord.chain
    }
    const updatedRecord = await acceptPaymentQuote(paymentConfig)
    const result = await fetchBlindpayCryptoToFiatTransferRecord(recordId, profileId)
    return { isExternalAccountExist: true, transferResult: result }
}

const createTransferToBlindpaySmartContract = async (config) => {
    const { requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, sourceBastionUserId, sourceWalletType, feeTransactionId } = config
    
    const { isExternalAccountExist, blindpayAccountId, destinationUserId } = await blindpayRailCheck(destinationAccountId)
    if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }
	config.blindpayAccountId = blindpayAccountId
    config.destinationUserId = destinationUserId
    const initialTransferRecord = await initTransferData(config);

    if(!await checkBalanceForTransactionFee(initialTransferRecord.id, transferType.CRYPTO_TO_FIAT)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Insufficient balance for transaction fee"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const result = fetchBlindpayCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }

    if(!await checkBalanceForTransactionAmount(sourceBastionUserId, amount, chain, sourceCurrency)){
        const toUpdate = {
            transaction_status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        await updateRequestRecord(initialTransferRecord.id, toUpdate)
        const result = fetchBlindpayCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
		return { isExternalAccountExist: true, transferResult: result }
    }

    let quoteAmount = initialTransferRecord.amount;
    // if there is fee, deduct fee from amount
    if(initialTransferRecord.developer_fee_id){
        // get fee config
        const { data: feeRecord, error: feeRecordError } = await supabase
            .from("developer_fees")
            .select("*")
            .eq("id", initialTransferRecord.developer_fee_id)
            .single()
        if (feeRecordError) throw feeRecordError
        if(!feeRecord) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Fee record not found")
        quoteAmount = (quoteAmount - feeRecord.fee_amount).toFixed(2)
    }

    const quoteConfig = {
        recordId: initialTransferRecord.id,
        blindpayAccountId: initialTransferRecord.to_blindpay_account_id,
        chain: initialTransferRecord.chain,
        amount: quoteAmount,
        sourceUserId: initialTransferRecord.bastion_user_id,
        contractAddress: initialTransferRecord.contract_address,
        bastionRequestId: initialTransferRecord.bastion_request_id
    }
    const blindpayQuoteResponse = await createPaymentQuote(quoteConfig);

    const conversionRate = {...blindpayQuoteResponse};
    delete conversionRate.contract;

    const toUpdate = {
        blindpay_quote_response: blindpayQuoteResponse,
        blindpay_quote_id: blindpayQuoteResponse.id,
        conversion_rate: conversionRate
    }
    await updateRequestRecord(initialTransferRecord.id, toUpdate)
	const result = await fetchBlindpayCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
	return { isExternalAccountExist: true, transferResult: result }
}

// This function is not used in the current implementation. We don't submit a async job for Blindpay transfer.
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

const acceptBlindpayCryptoToFiatTransfer = async (config) => {
	const {recordId, profileId} = config
    // accept quote and update record
	const {data: record, error: recordError} = await supabase
		.from("offramp_transactions")
		.select()
		.eq("id", recordId)
		.maybeSingle()

	if (recordError) throw recordError
	if (!record) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "No transaction for provided record Id")

    const toUpdate = {
        transaction_status: "CREATED"
    }
    await updateRequestRecord(recordId, toUpdate)
    // create Job
	const jobConfig = {
		recordId
	}
	if (await cryptoToFiatTransferScheduleCheck("cryptoToFiatTransfer", jobConfig, record.user_id, profileId)) {
		await createJob("cryptoToFiatTransfer", jobConfig, record.user_id, profileId)
	}
	const result = await fetchBlindpayCryptoToFiatTransferRecord(recordId, profileId)
	return result
}

module.exports = {
	createTransferToBlindpaySmartContract,
    acceptBlindpayCryptoToFiatTransfer,
	executeAsyncBlindpayTransferCryptoToFiat
}