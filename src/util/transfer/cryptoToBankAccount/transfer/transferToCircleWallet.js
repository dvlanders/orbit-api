const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const circleRailCheck = require("../railCheck/circleRailCheck");
const { getAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { v4 } = require('uuid');
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const transferToCircleWallet = async (requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, createdRecordId=null) => {

	// FIXME Sam
	// if (amount < 1) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "amount should be at least 1")

	// check if a circle_accounts record with id == destinationAccountId exists
	const { circleAccountExists } = await circleRailCheck(sourceUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain)
	if (!circleAccountExists) return { isExternalAccountExist: false, transferResult: null }

	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	//insert the initial record
	const { data: initialBastionTransfersInsertData, error: initialBastionTransfersInsertError } = await supabase
		.from('offramp_transactions')
		.insert({
			request_id: requestId,
			user_id: sourceUserId,
			destination_user_id: destinationUserId,
			amount: amount,
			chain: chain,
			from_wallet_address: getAddress(sourceWalletAddress),
			to_wallet_address: process.env.CIRCLE_MASTER_WALLET_BLOCKCHAIN_ADDRESS,
			circle_account_id: destinationAccountId,
			transaction_status: 'NOT_INITIATED',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "CIRCLE",
			crypto_provider: "BASTION",
			destination_currency: destinationCurrency,
		})
		.select()
		.single()

	if (initialBastionTransfersInsertError) {
		console.error('initialBastionTransfersInsertError', initialBastionTransfersInsertError);
		await createLog("transfer/util/transferToCircleWallet", sourceUserId, initialBastionTransfersInsertError.message, initialBastionTransfersInsertError)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}



	//create transfer with Bastion
	const decimals = currencyDecimal[sourceCurrency]

	const transferAmount = toUnitsString(amount, decimals)

	const bodyObject = {
		requestId: initialBastionTransfersInsertData.id,
		userId: sourceUserId,
		contractAddress: contractAddress,
		actionName: "transfer",
		chain: chain,
		actionParams: erc20Transfer(sourceCurrency, process.env.CIRCLE_MASTER_WALLET_BLOCKCHAIN_ADDRESS, transferAmount)
	};

	const url = `${BASTION_URL}/v1/user-actions`;
	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};


	const response = await fetch(url, options);
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

	// fail to transfer
	if (!response.ok) {
		const { error: updateError } = await supabase
			.from('offramp_transactions')
			.update({
				bastion_response: responseBody,
				bastion_transaction_status: "FAILED",
				transaction_status: "NOT_INITIATED",
			})
			.match({ id: initialBastionTransfersInsertData.id })

		if (updateError) {
			await createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, updateError.message, updateError)
			throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "An unexpected error occurred")
		}

		await createLog("transfer/util/transfer", sourceUserId, responseBody.message, responseBody)
		if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance") {
			result.transferDetails.status = "NOT_INITIATED"
			result.transferDetails.failedReason = "transfer amount exceeds balance"
			// throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "transfer amount exceeds balance")
		} else {
			result.transferDetails.status = "NOT_INITIATED"
			result.transferDetails.failedReason = "Not enough gas, please contact HIFI for more information"
			// throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, responseBody.message)
		}
	} else {
		// bastion might return 200 response with failed transaction
		result.transferDetails.transactionHash = responseBody.transactionHash
		result.transferDetails.status = responseBody.status == "FAILED" ? "FAILED_ONCHAIN" : "SUBMITTED_ONCHAIN"

		const { error: updateError } = await supabase
			.from('offramp_transactions')
			.update({
				bastion_response: responseBody,
				transaction_hash: responseBody.transactionHash,
				bastion_transaction_status: responseBody.status,
				transaction_status: result.transferDetails.status
			})
			.match({ id: initialBastionTransfersInsertData.id })

		if (updateError) {
			await createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, updateError.message, updateError)
			throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "An unexpected error occurred")
		}
	}


	return { isExternalAccountExist: true, transferResult: result }

}

module.exports = transferToCircleWallet