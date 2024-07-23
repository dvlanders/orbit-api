const { currencyContractAddress, currencyDecimal } = require("../../../common/blockchain");
const supabase = require("../../../supabaseClient");
const bridgeRailCheck = require("../railCheck/bridgeRailCheck");
const { getAddress } = require("ethers");
const { CreateCryptoToBankTransferError, CreateCryptoToBankTransferErrorType } = require("../utils/createTransfer");
const createLog = require("../../../logger/supabaseLogger");
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits");
const { transferType } = require("../../utils/transfer");
const { getFeeConfig } = require("../../fee/utils");
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap");
const { getMappedError } = require("../utils/errorMappings");
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveTokenBastion");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount");
const { CryptoToFiatWithFeeBastion } = require("../../fee/CryptoToFiatWithFeeBastion");
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction");
const bastionGasCheck = require("../../../bastion/utils/gasCheck");
const { cryptoToFiatTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoToFiatTransfer/scheduleCheck");
const createJob = require("../../../../../asyncJobs/createJob");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

const transferToBridgeLiquidationAddress = async (requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, feeType, feeValue, createdRecordId=null) => {
	// if (amount < 1) throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "amount should be at least 1")
	const { isExternalAccountExist, liquidationAddress, liquidationAddressId, bridgeExternalAccountId } = await bridgeRailCheck(destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain)

	if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }

	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	// fetch or insert request record
	let initialBastionTransfersInsertData
	if (createdRecordId){
		// fetch from created record
		const {data, error} = await supabase
			.from('offramp_transactions')
			.select("*")
			.eq("id", createdRecordId)
			.single()
		
		if (error) {
			createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, error.message)
			throw new CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
		}

		initialBastionTransfersInsertData = data

	}else{
		//insert the initial record
		const { data, error: initialBastionTransfersInsertError } = await supabase
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
				transaction_status: 'CREATED',
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

		initialBastionTransfersInsertData = data
	}

	// transfer
	if (feeType && parseFloat(feeValue) > 0){
		// transfer with fee charged
        // check if allowance is enough 
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        if (!paymentProcessorContractAddress) {
            // no paymentProcessorContract available
            const toUpdate = {
                status: "NOT_INITIATED",
                failed_reason: `Fee feature not available for ${currency} on ${chain}`
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
        let {feePercent, feeAmount} = getFeeConfig(feeType, feeValue, amount)
		const decimals = currencyDecimal[sourceCurrency]
		const transferAmount = toUnitsString(amount, decimals)

		// fetch fee record if not create one
		let feeRecord
		if (initialBastionTransfersInsertData.developer_fee_id){
			const {data: record, error} = await supabase
			.from("developer_fees")
			.select("*")
			.eq("id", initialBastionTransfersInsertData.developer_fee_id)
			.single()
		
			if (error) throw error
			if (!record) throw new Error(`No fee record found for ${initialBastionTransfersInsertData.developer_fee_id}`)
			feeRecord = record
		}else{
			const info = {
				chargedUserId: sourceUserId,
				chain: chain,
				currency: sourceCurrency,
				chargedWalletAddress: sourceWalletAddress
			}
			feeRecord = await createNewFeeRecord(initialBastionTransfersInsertData.id, feeType, feePercent, feeAmount, profileId, info, transferType.CRYPTO_TO_FIAT, "BASTION")
			// update into crypto to crypto table
			await updateRequestRecord(initialBastionTransfersInsertData.id, {developer_fee_id: feeRecord.id})
		}

        if (allowance < BigInt(transferAmount)){
            // not enough allowance, perform a token allowance job and then schedule a token transfer job
            await approveMaxTokenToPaymentProcessor(sourceUserId, chain, sourceCurrency)
            const canSchedule = await cryptoToFiatTransferScheduleCheck("cryptoToFiatTransfer", {recordId: initialBastionTransfersInsertData.id, destinationAccountId, destinationCurrency, profileId, feeType, feeValue, sourceCurrency}, sourceUserId, profileId)
            if (canSchedule){
                await createJob("cryptoToFiatTransfer", {recordId: initialBastionTransfersInsertData.id, destinationAccountId, destinationCurrency, profileId, feeType, feeValue, sourceCurrency}, sourceUserId, profileId, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
            }
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
        }else{
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
            // gas check
            await bastionGasCheck(sourceUserId, chain)
			return { isExternalAccountExist: true, transferResult: result }
        }

	}else{
		//create transfer without fee
		const decimals = currencyDecimal[sourceCurrency]
		const transferAmount = toUnitsString(amount, decimals)
		const bodyObject = {
			requestId: initialBastionTransfersInsertData.bastion_request_id,
			userId: sourceUserId,
			contractAddress: contractAddress,
			actionName: "transfer",
			chain: chain,
			actionParams: erc20Transfer(sourceCurrency, liquidationAddress, transferAmount)
		};

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
			createLog("transfer/util/transferToBridgeLiquidationAddress", sourceUserId, responseBody.message, responseBody)
			const { message, type } = getMappedError(responseBody.message)
			result.transferDetails.status = "NOT_INITIATED"
			result.transferDetails.failedReason = message

			const toUpdate = {
				bastion_response: responseBody,
				bastion_transaction_status: "FAILED",
				transaction_status: "NOT_INITIATED",
				failed_reason: message
			}
			
			const updatedRecord = await updateRequestRecord(initialBastionTransfersInsertData.id, toUpdate)
		}else{
			// bastion might return 200 response with failed transaction
			result.transferDetails.transactionHash = responseBody.transactionHash
			result.transferDetails.status = responseBody.status == "FAILED" ? "NOT_INITIATED" : "SUBMITTED_ONCHAIN"

			const toUpdate = {
				bastion_response: responseBody,
				transaction_hash: responseBody.transactionHash,
				bastion_transaction_status: responseBody.status,
				transaction_status: result.transferDetails.status,
				failed_reason: responseBody.failureDetails,
			}
			const updatedRecord = await updateRequestRecord(initialBastionTransfersInsertData.id, toUpdate)
		}

		// gas check
		await bastionGasCheck(sourceUserId, chain)

		return { isExternalAccountExist: true, transferResult: result }


	}
}

module.exports = transferToBridgeLiquidationAddress