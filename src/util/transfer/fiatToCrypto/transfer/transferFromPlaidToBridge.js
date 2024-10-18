const createLog = require("../../../logger/supabaseLogger");
const { transferType } = require("../../utils/transfer");
const bridgePlaidRailCheck = require("../railCheck/bridgePlaidRailCheck");
const { getLastBridgeVirtualAccountActivity } = require("../utils/getLastBridgeVirtualAccountActivity");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../utils/utils");
const { isValidAmount } = require("../../../common/transferValidation");
const { getMappedError } = require("../utils/errorMappings")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveToken");
const { getFeeConfig } = require("../../fee/utils");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { v4 } = require("uuid");
const fetchCheckbookBridgeFiatToCryptoTransferRecord = require("./fetchCheckbookBridgeFiatToCryptoTransferRecord");
const { simulateSandboxFiatToCryptoTransactionStatus } = require("../utils/simulateSandboxFiatToCryptoTransaction");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { getUserWallet } = require("../../../user/getUserWallet");
const { insertSingleBridgeTransactionRecord } = require("../../../bridge/bridgeTransactionTableService");
const { insertCheckbookTransactionRecord, updateCheckbookTransactionRecord } = require("../../../checkbook/checkbookTransactionTableService");
const { updateOnrampTransactionRecord } = require("../utils/onrampTransactionTableService");
const { executeCheckbookDirectPayment } = require("../../../checkbook/endpoint/executeCheckbookDirectPayment");

const initTransferData = async (config) => {
    const { recordId, requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, accountInfo, feeTransactionId, transferInfo} = config;

    const lastBridgeVirtualAccountActivity = await getLastBridgeVirtualAccountActivity(destinationUserId, transferInfo.bridge_virtual_account_id)
    const billingTags = await getBillingTagsFromAccount(requestId, transferType.FIAT_TO_CRYPTO, sourceUserId, accountInfo)

    	// insert bridge transaction record
	const toInsertBridgeRecord = {
		user_id: sourceUserId,
		request_id: v4(),
        last_bridge_virtual_account_event_id: lastBridgeVirtualAccountActivity,
        virtual_account_id: transferInfo.virtual_account_id,
        bridge_virtual_account_id: transferInfo.bridge_virtual_account_id,
        bridge_user_id: transferInfo.bridge_id
	}
	const bridgeRecord = await insertSingleBridgeTransactionRecord(toInsertBridgeRecord)

    const toInsertCheckbookRecord = {
        user_id: sourceUserId,
        plaid_checkbook_id: transferInfo.plaid_checkbook_id,
        destination_checkbook_user_id: transferInfo.recipient_checkbook_user_id,
    }
    const checkbookRecord = await insertCheckbookTransactionRecord(toInsertCheckbookRecord)

    const toUpdateOnrampRecord = {
        user_id: sourceUserId,
        destination_user_id: destinationUserId,
        amount: amount,
        status: "CREATED",
        fiat_provider: "CHECKBOOK",
        crypto_provider: "BRIDGE",
        source_currency: sourceCurrency,
        destination_currency: destinationCurrency,
        chain: chain,
        billing_tags_success: billingTags.success,
        billing_tags_failed: billingTags.failed,
        fee_transaction_id: feeTransactionId,
        bridge_transaction_record_id: bridgeRecord.id,
        checkbook_transaction_record_id: checkbookRecord.id
    }

    const initialRecord = await updateOnrampTransactionRecord(recordId, toUpdateOnrampRecord);

    // create fee record
    let feeRecord
    if (feeType && parseFloat(feeValue) > 0){
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const {feePercent, feeAmount} = getFeeConfig(feeType, feeValue, amount)

        if (!paymentProcessorContractAddress) {
            // no paymentProcessorContract available
            const toUpdate = {
                status: "FAILED",
                failed_reason: `Fee feature not available for ${destinationCurrency} on ${chain}`
            }
            return await updateOnrampTransactionRecord(initialRecord.id, toUpdate)
        }
        const info = {
            chargedUserId: destinationUserId,
            chain,
            currency: destinationCurrency,
            chargedWalletAddress: transferInfo.destinationWalletAddress
        }
        const {walletProvider} = await getUserWallet(destinationUserId, chain)
        feeRecord = await createNewFeeRecord(initialRecord.id, feeType, feePercent, feeAmount, profileId, info, transferType.FIAT_TO_CRYPTO,walletProvider, v4())
        // update into crypto to crypto table
        return await updateOnrampTransactionRecord(initialRecord.id, {developer_fee_id: feeRecord.id})
    }

    return initialRecord;

}

const transferFromPlaidToBridge = async(configs) => {
    const {requestId, recordId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, accountInfo, feeTransactionId} = configs
    try{
        if(!isValidAmount(amount, 1)) throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
        const transferInfo = await bridgePlaidRailCheck(sourceAccountId, sourceCurrency, destinationCurrency, chain, sourceUserId, destinationUserId)

        const initialRecord = await initTransferData({...configs, transferInfo});

        // if the user does not have enough balance for the transaction fee, then fail the transaction
        if(!await checkBalanceForTransactionFee(initialRecord.id, transferType.FIAT_TO_CRYPTO)){
            const toUpdate = {
                status: "FAILED",
                failed_reason: "Insufficient balance for transaction fee"
            }
            await updateOnrampTransactionRecord(initialRecord.id, toUpdate)
            return await fetchCheckbookBridgeFiatToCryptoTransferRecord(initialRecord.id, profileId)
        }

        const {response, responseBody} = await executeCheckbookDirectPayment(transferInfo.recipient_checkbook_user_id, transferInfo.plaid_account_type, transferInfo.routing_number, transferInfo.account_number, destinationUserId, amount, transferInfo.plaid_checkbook_id, initialRecord.id, transferInfo.api_key, transferInfo.api_secret);
        
        if (!response.ok){
            await updateOnrampTransactionRecord(initialRecord.id, { status: "SUBMISSION_FAILED" });
            await updateCheckbookTransactionRecord(initialRecord.checkbook_transaction_record_id, { checkbook_response: responseBody });
            await createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, responseBody.message, responseBody)
            const { message, type } = getMappedError(responseBody.error)
            throw new CreateFiatToCryptoTransferError(type, message, responseBody)
        }
        const toUpdateRecord = {
            status: "FIAT_SUBMITTED",
        }

        const toUpdateCheckbook = {
            checkbook_response: responseBody,
            checkbook_payment_id: responseBody.id,
            checkbook_status: responseBody.status
        }

        if (process.env.NODE_ENV === "development" && false){
            toUpdateRecord.status = "CONFIRMED"
            toUpdateCheckbook.checkbook_status = "PAID"
        }

        const updatedRecord = await updateOnrampTransactionRecord(initialRecord.id, toUpdateRecord);
        await updateCheckbookTransactionRecord(initialRecord.checkbook_transaction_record_id, toUpdateCheckbook);


        if (isInstant){
            // perform instant crypto transfer
        }

        if (process.env.NODE_ENV === "development") await simulateSandboxFiatToCryptoTransactionStatus(updatedRecord, ["FIAT_SUBMITTED", "FIAT_PROCESSED", "CRYPTO_SUBMITTED", "CONFIRMED"])

        const result = await fetchCheckbookBridgeFiatToCryptoTransferRecord(updatedRecord.id, profileId)

        return result

    }catch (error){
        if (! (error instanceof CreateFiatToCryptoTransferError)){
            await createLog("transfer/util/transferFromPlaidToBridge", sourceUserId, error.message, error)
        }
        throw error
    }

}

module.exports = transferFromPlaidToBridge