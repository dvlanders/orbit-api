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
const bastionGasCheck = require("../../../bastion/utils/gasCheck");
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

const initTransferData = async(config) => {
	const {requestId, sourceUserId, destinationUserId, destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, sourceWalletAddress, profileId, destinationUserBridgeId, sourceWalletType, bridgeExternalAccountId, feeType, feeValue, sourceBastionUserId, sameDayAch, paymentRail} = config
	// get conversion rate
	const conversionRate = await getBridgeConversionRate(sourceCurrency, destinationCurrency, profileId)
	//get crypto contract address
	const contractAddress = currencyContractAddress[chain][sourceCurrency]

	//insert the initial record
	const { data: record, error: recordError } = await supabase
		.from('offramp_transactions')
		.insert({
			request_id: requestId,
			user_id: destinationUserId,
			destination_user_id: destinationUserId,
			amount: amount,
			chain: chain,
			from_wallet_address: isAddress(sourceWalletAddress) ? getAddress(sourceWalletAddress) : sourceWalletAddress,
			to_bridge_external_account_id: bridgeExternalAccountId, // actual id that bridge return to us
			transaction_status: 'CREATED',
			contract_address: contractAddress,
			fiat_provider: "BRIDGE",
			crypto_provider: "EXTERNAL",
			conversion_rate: conversionRate,
			source_currency: sourceCurrency,
			destination_currency: destinationCurrency,
			destination_account_id: destinationAccountId,
			transfer_from_wallet_type: sourceWalletType,
            same_day_ach: sameDayAch? sameDayAch: false
		})
		.select()
		.single()
	
	if (recordError) throw recordError

	// create a bridge transfer
    const _paymentRail = paymentRail
    if (sameDayAch && paymentRail == "ach"){
        _paymentRail = "ach_same_day"
    }

	const source = {
		currency: sourceCurrency,
		payment_rail: chainToVirtualAccountPaymentRail[chain],
		from_address: sourceWalletAddress
	}
	const destination = {
		currency: destinationCurrency,
		payment_rail: _paymentRail,
		external_account_id: bridgeExternalAccountId
	}
	const clientReceivedAmount = parseFloat(amount).toFixed(2)
	const bridgeResponse = await createBridgeTransfer(record.id, clientReceivedAmount, destinationUserBridgeId, source, destination)
	const bridgeResponseBody = await bridgeResponse.json()
	if (!bridgeResponse.ok) {
		// failed to create tranfser
		await createLog("transfer/createBridgeDirectCryptoToFiatTransfer", destinationUserId, bridgeResponseBody.message, bridgeResponseBody, profileId)
		const toUpdate = {
			transaction_status: "NOT_INITIATED",
			updated_at: new Date().toISOString(),
			bridge_response: bridgeResponseBody,
			failed_reason: "Please contact HIFI for more information"
		}
		const updatedRecord = await updateRequestRecord(record.id, toUpdate)
		return updatedRecord
	}

	// update record
	const liquidationAddress = bridgeResponseBody.source_deposit_instructions.to_address
	const toUpdate = {
		updated_at: new Date().toISOString(),
        transaction_status: "AWAITING_FUNDS",
		bridge_transaction_status: bridgeResponseBody.state,
		bridge_response: bridgeResponseBody,
		bridge_transfer_id: bridgeResponseBody.id,
		to_wallet_address: isAddress(liquidationAddress) ? getAddress(liquidationAddress) : liquidationAddress
	}
	const updatedRecord = await updateRequestRecord(record.id, toUpdate)

	// return if no fee charged
    return updatedRecord
}

const createBridgeDirectCryptoToFiatTransfer = async (config) => {
	const {destinationAccountId, sourceCurrency, destinationCurrency, chain, amount, feeType, feeValue, profileId, sourceWalletAddress} = config
	
	// check destination bank account information
	const { isExternalAccountExist, destinationUserBridgeId, bridgeExternalAccountId, destinationUserId } = await bridgeRailCheck(destinationAccountId, destinationCurrency)
	config.destinationUserId = destinationUserId
	config.destinationUserBridgeId = destinationUserBridgeId
	config.bridgeExternalAccountId = bridgeExternalAccountId
	if (!isExternalAccountExist) return { isExternalAccountExist: false, transferResult: null }

	// fetch or insert request record
	const initialTransferRecord = await initTransferData(config)


	const result = await fetchBridgeCryptoToFiatTransferRecord(initialTransferRecord.id, profileId)
    const transferResult = {
        ...result,
        transferDetails: {
            ...result.transferDetails,
            depositInstruction:{
                currency: result.transferDetails.sourceCurrency,
                amount: result.transferDetails.amount,
                chain: result.transferDetails.chain,
                depositToAddress: result.transferDetails.liquidationAddress,
                depositFromAddress: sourceWalletAddress
            }
        }
        
    } 
	return { isExternalAccountExist: true, transferResult }
}

module.exports = {
    createBridgeDirectCryptoToFiatTransfer
}