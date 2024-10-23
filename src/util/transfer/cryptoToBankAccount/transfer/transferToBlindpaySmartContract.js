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
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveToken");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount");
const { CryptoToFiatWithFeeBastion } = require("../../fee/CryptoToFiatWithFeeBastion");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const { cryptoToFiatTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoToFiatTransfer/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { getMappedError } = require("../../../bastion/utils/errorMappings");
const { getBlindpayChain } = require("../../../blindpay/blockchain");
const { createQuote } = require("../../../blindpay/endpoint/createQuote");

const transferToBlindpaySmartContract = async (config) => {
	const { requestId, sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, sourceWalletType } = config
	// console.log("transferToBlindpaySmartContract", config)
	// disable fee feature
	if (feeType || feeValue > 0) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Fee collection feature is not yet available for this route")
	if (amount < 10) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 10.")
	const { isExternalAccountExist, blindpayAccountId, destinationUserId } = await blindpayRailCheck(destinationAccountId)
	if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }

	const contractAddress = getBlindpayContractAddress(chain, sourceCurrency)

	//insert the initial record
	const { data: initialBastionTransfersInsertData, error: initialBastionTransfersInsertError } = await supabase
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

	if (initialBastionTransfersInsertError) {
		console.error('initialBastionTransfersInsertError', initialBastionTransfersInsertError);
		await createLog("transfer/util/transferToBlindpaySmartContract", sourceUserId, initialBastionTransfersInsertError.message)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	// TODO: Configure for Blindpay isntead of Bridge offramp
	if (feeType && parseFloat(feeValue) > 0) {
		// transfer with fee charged
		// check if allowance is enough 
		const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
		if (!paymentProcessorContractAddress) {
			// no paymentProcessorContract available
			const toUpdate = {
				status: "NOT_INITIATED",
				failed_reason: `Fee feature not available for ${sourceCurrency} on ${chain}`
			}
			record = await updateRequestRecord(initialBastionTransfersInsertData.id, toUpdate)
			return {
				transferType: transferType.CRYPTO_TO_FIAT,
				transferDetails: {
					id: initialBastionTransfersInsertData.id,
					requestId,
					sourceUserId,
					destinationUserId,
					chain,
					sourceCurrency,
					amount,
					status: "NOT_INITIATED",
					destinationCurrency,
					destinationAccountId,
					createdAt: initialBastionTransfersInsertData.created_at,
					updatedAt: initialBastionTransfersInsertData.updated_at,
					contractAddress: contractAddress,
					failedReason: toUpdate.failed_reason,
				}
			}
		}

		const allowance = await getTokenAllowance(chain, sourceCurrency, sourceWalletAddress, paymentProcessorContractAddress)
		let { feePercent, feeAmount } = getFeeConfig(feeType, feeValue, amount)
		const decimals = currencyDecimal[sourceCurrency]
		const transferAmount = toUnitsString(amount, decimals)

		// fetch fee record if not create one
		let feeRecord
		if (initialBastionTransfersInsertData.developer_fee_id) {
			const { data: record, error } = await supabase
				.from("developer_fees")
				.select("*")
				.eq("id", initialBastionTransfersInsertData.developer_fee_id)
				.single()

			if (error) throw error
			if (!record) throw new Error(`No fee record found for ${initialBastionTransfersInsertData.developer_fee_id}`)
			feeRecord = record
		} else {
			const info = {
				chargedUserId: sourceUserId,
				chain: chain,
				currency: sourceCurrency,
				chargedWalletAddress: sourceWalletAddress
			}
			feeRecord = await createNewFeeRecord(initialBastionTransfersInsertData.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, "BASTION", initialBastionTransfersInsertData.bastion_request_id)
			// update into crypto to crypto table
			await updateRequestRecord(initialBastionTransfersInsertData.id, { developer_fee_id: feeRecord.id })
		}

		if (allowance < BigInt(transferAmount)) {
			// not enough allowance, perform a token allowance job and then schedule a token transfer job
			await approveMaxTokenToPaymentProcessor(sourceUserId, chain, sourceCurrency)
			await createJob("cryptoToFiatTransfer", { recordId: initialBastionTransfersInsertData.id, destinationAccountId, destinationCurrency, profileId, feeType, feeValue, sourceCurrency }, sourceUserId, profileId, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
			// return creatred record
			const result = {
				transferType: transferType.CRYPTO_TO_FIAT,
				transferDetails: {
					id: initialBastionTransfersInsertData.id,
					requestId,
					sourceUserId,
					destinationUserId,
					chain,
					sourceCurrency,
					amount,
					status: "CREATED",
					destinationCurrency,
					destinationAccountId,
					createdAt: initialBastionTransfersInsertData.created_at,
					updatedAt: initialBastionTransfersInsertData.updated_at,
					contractAddress: contractAddress,
					failedReason: null,
					fee: {
						feeId: feeRecord.id,
						feeType,
						feeAmount,
						feePercent,
						status: "CREATED",
						transactionHash: null,
						failedReason: null,
					},
				}
			}

			return { isExternalAccountExist: true, transferResult: result }
		} else {
			// perfrom transfer with fee
			const info = {
				chain,
				sourceUserId,
				sourceCurrency,
				sourceWalletAddress,
				contractAddress,
				liquidationAddress,
				transferAmount,
				destinationAccountId
			}
			const result = await CryptoToFiatWithFeeBastion(initialBastionTransfersInsertData, feeRecord, paymentProcessorContractAddress, feeType, feePercent, feeAmount, profileId, info)
			return { isExternalAccountExist: true, transferResult: result }
		}

	} else {

		let blindpayQuoteResponse;
		try{
			const quoteAmount = amount * 100; // 100 represents 1
			const network = getBlindpayChain(chain);
			const token = process.env.NODE_ENV == "development" ? "USDB" : "USDC"; // Blindpay uses USDB for sandbox, I think its their own token?
			blindpayQuoteResponse = await createQuote(blindpayAccountId, quoteAmount, network, token);
		}catch(error){
			if(error instanceof CreateQuoteError){
				await createLog("transfer/util/transferToBlindpaySmartContract", sourceUserId, error.message, error.rawResponse)
				await updateRequestRecord(initialBastionTransfersInsertData.id, {blindpay_quote_response: error.rawResponse})
			}else{
				await createLog("transfer/util/transferToBlindpaySmartContract", sourceUserId, error.message, error)
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
			requestId: initialBastionTransfersInsertData.bastion_request_id,
			userId: sourceUserId,
			contractAddress: contractAddress, // blindpayQuoteResponse.contract.address,
			actionName: blindpayQuoteResponse.contract.functionName,
			chain: chain === "POLYGON_AMOY" ? "BASE_SEPOLIA" : chain, 
			actionParams: actionParams
		};
		// console.log(bodyObject)
		const response = await submitUserAction(bodyObject)
		const responseBody = await response.json();
		const result = {
			transferType: transferType.CRYPTO_TO_FIAT,
			transferDetails: {
				id: initialBastionTransfersInsertData.id,
				requestId,
				sourceUserId,
				destinationUserId,
				chain,
				sourceCurrency,
				amount,
				destinationCurrency,
				destinationAccountId,
				createdAt: initialBastionTransfersInsertData.created_at,
				contractAddress: contractAddress,
				failedReason: ""
			}
		}

		// map status
		if (!response.ok) {
			// fail to transfer
			await createLog("transfer/util/transferToBlindpaySmartContract", sourceUserId, responseBody.message, responseBody)
			const { message, type } = getMappedError(responseBody.message)
			result.transferDetails.status = "NOT_INITIATED"
			result.transferDetails.failedReason = message

			const toUpdate = {
				bastion_response: responseBody,
				bastion_transaction_status: "FAILED",
				transaction_status: "NOT_INITIATED",
				failed_reason: message,
				blindpay_quote_response: blindpayQuoteResponse,
				blindpay_quote_id: blindpayQuoteResponse.id,
				conversion_rate: conversionRate
			}

			// in sandbox, just return SUBMITTED_ONCHAIN status
			if (process.env.NODE_ENV == "development") {
				result.transferDetails.status = "SUBMITTED_ONCHAIN"
				result.transferDetails.failedReason = "This is a simulated success response for sandbox environment only."
				toUpdate.bastion_transaction_status = "CONFIRMED"
				toUpdate.transaction_status = "SUBMITTED_ONCHAIN"
				toUpdate.failed_reason = "This is a simulated success response for sandbox environment only."
			}

			const updatedRecord = await updateRequestRecord(initialBastionTransfersInsertData.id, toUpdate)
		} else {
			// bastion might return 200 response with failed transaction
			result.transferDetails.transactionHash = responseBody.transactionHash
			result.transferDetails.status = responseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN"

			const toUpdate = {
				bastion_response: responseBody,
				transaction_hash: responseBody.transactionHash,
				bastion_transaction_status: responseBody.status,
				transaction_status: result.transferDetails.status,
				failed_reason: responseBody.failureDetails,
				blindpay_quote_response: blindpayQuoteResponse,
				blindpay_quote_id: blindpayQuoteResponse.id,
				conversion_rate: conversionRate
			}
			const updatedRecord = await updateRequestRecord(initialBastionTransfersInsertData.id, toUpdate)
		}


		return { isExternalAccountExist: true, transferResult: result }


	}
}

module.exports = transferToBlindpaySmartContract