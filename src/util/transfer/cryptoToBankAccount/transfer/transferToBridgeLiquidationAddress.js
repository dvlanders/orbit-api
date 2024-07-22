const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const bridgeRailCheck = require("../railCheck/bridgeRailCheck");
const { getAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { isValidAmount } = require("../../../common/transferValidation")
const { getMappedError } = require("../utils/errorMappings")

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const transferToBridgeLiquidationAddress = async (requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress) => {
	if (!isValidAmount(amount, 1)) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
	const { isExternalAccountExist, liquidationAddress, liquidationAddressId, bridgeExternalAccountId } = await bridgeRailCheck(destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain)

	if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }

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
			to_wallet_address: getAddress(liquidationAddress),
			to_bridge_liquidation_address_id: liquidationAddressId, // actual id that bridge return to us
			to_bridge_external_account_id: bridgeExternalAccountId, // actual id that bridge return to us
			transaction_status: 'NOT_INITIATED',
			contract_address: contractAddress,
			action_name: "transfer",
			fiat_provider: "BRIDGE",
			crypto_provider: "BASTION"
		})
		.select()
		.single()

	if (initialBastionTransfersInsertError) {
		console.error('initialBastionTransfersInsertError', initialBastionTransfersInsertError);
		createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, initialBastionTransfersInsertError.message)
		throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
	}

	//create transfer
	const decimals = currencyDecimal[sourceCurrency]
	const transferAmount = toUnitsString(amount, decimals)
	const bodyObject = {
		requestId: initialBastionTransfersInsertData.id,
		userId: sourceUserId,
		contractAddress: contractAddress,
		actionName: "transfer",
		chain: chain,
		actionParams: [
			{ name: "to", value: liquidationAddress },
			{ name: "value", value: transferAmount }
		],
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
		createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, responseBody.message, responseBody)
        const { message, type } = getMappedError(responseBody.message)
		result.transferDetails.status = "NOT_INITIATED"
        result.transferDetails.failedReason = message
		
		const { error: updateError } = await supabase
			.from('offramp_transactions')
			.update({
				bastion_response: responseBody,
				bastion_transaction_status: "FAILED",
				transaction_status: "NOT_INITIATED",
				failed_reason: result.transferDetails.failedReason
			})
			.match({ id: initialBastionTransfersInsertData.id })

		if (updateError) {
			createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, updateError.message)
			throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
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
				transaction_status: result.transferDetails.status,
				failed_reason: responseBody.failureDetails 
			})
			.match({ id: initialBastionTransfersInsertData.id })

		if (updateError) {
			createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, updateError.message)
			throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
		}
	}


	return { isExternalAccountExist: true, transferResult: result }

}

module.exports = transferToBridgeLiquidationAddress