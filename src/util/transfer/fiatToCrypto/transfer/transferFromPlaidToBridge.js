const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { transferType } = require("../../utils/transfer");
const bridgePlaidRailCheck = require("../railCheck/bridgePlaidRailCheck");
const { getLastBridgeVirtualAccountActivity } = require("../utils/getLastBridgeVirtualAccountActivity");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../utils/utils");
const { isValidAmount } = require("../../../common/transferValidation");
const { getMappedError } = require("../utils/errorMappings")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveToken");
const { updateRequestRecord } = require("../utils/updateRequestRecord");
const { getFeeConfig } = require("../../fee/utils");
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord");
const { v4 } = require("uuid");
const fetchCheckbookBridgeFiatToCryptoTransferRecord = require("./fetchCheckbookBridgeFiatToCryptoTransferRecord");
const { simulateSandboxFiatToCryptoTransactionStatus } = require("../utils/simulateSandboxFiatToCryptoTransaction");
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling");
const { getBillingTagsFromAccount } = require("../../utils/getBillingTags");
const { getUserWallet } = require("../../../user/getUserWallet");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const transferFromPlaidToBridge = async(configs) => {
    const {requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId, feeType, feeValue, profileId, accountInfo, feeTransactionId} = configs
    try{
        if(!isValidAmount(amount, 1)) throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 1.")
        const transferInfo = await bridgePlaidRailCheck(sourceAccountId, sourceCurrency, destinationCurrency, chain, sourceUserId, destinationUserId)
        // get the last virtual account activity
        const lastBridgeVirtualAccountActivity = await getLastBridgeVirtualAccountActivity(destinationUserId, transferInfo.bridge_virtual_account_id)

        //get billing tags
        const billingTags = await getBillingTagsFromAccount(requestId, transferType.FIAT_TO_CRYPTO, sourceUserId, accountInfo)

        // insert record
        const {data: initialRecord, error: initialRecordError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .update({
                user_id: sourceUserId,
                destination_user_id: destinationUserId,
                amount: amount,
                plaid_checkbook_id: transferInfo.plaid_checkbook_id,
                bridge_virtual_account_id: transferInfo.bridge_virtual_account_id,
                destination_checkbook_user_id: transferInfo.recipient_checkbook_user_id,
                last_bridge_virtual_account_event_id: lastBridgeVirtualAccountActivity,
                status: "CREATED",
                fiat_provider: "CHECKBOOK",
                crypto_provider: "BRIDGE",
                source_currency: sourceCurrency,
                destination_currency: destinationCurrency,
                chain: chain,
                billing_tags_success: billingTags.success,
                billing_tags_failed: billingTags.failed,
                fee_transaction_id: feeTransactionId
            })
            .eq("request_id", requestId)
            .select()
            .single())
        if (initialRecordError) {
            await createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, initialRecordError.message, initialRecordError)
            throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, initialRecordError.message)
        } 

        // if the user does not have enough balance for the transaction fee, then fail the transaction
        if(!await checkBalanceForTransactionFee(initialRecord.id, transferType.FIAT_TO_CRYPTO)){
            const toUpdate = {
                status: "FAILED",
                failed_reason: "Insufficient balance for transaction fee"
            }
            await updateRequestRecord(initialRecord.id, toUpdate)
            return await fetchCheckbookBridgeFiatToCryptoTransferRecord(initialRecord.id, profileId)
        }

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
                await updateRequestRecord(initialRecord.id, toUpdate)
                return await fetchCheckbookBridgeFiatToCryptoTransferRecord(initialRecord.id, profileId)
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
            await updateRequestRecord(initialRecord.id, {developer_fee_id: feeRecord.id})
        }


        // execute checkbook payment
        const createDigitalPaymentUrl = `${CHECKBOOK_URL}/check/direct`;
        const body = {
            "recipient": transferInfo.recipient_checkbook_user_id,
            "account_type": transferInfo.plaid_account_type,
            "routing_number": transferInfo.routing_number,
            "account_number":transferInfo.account_number,
            "name": destinationUserId,
            "amount": amount,
            "account": transferInfo.plaid_checkbook_id,
            "description": initialRecord.id
        }
    
        const options = {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `${transferInfo.api_key}:${transferInfo.api_secret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        };

        const response = await fetch(createDigitalPaymentUrl, options);
        const responseBody = await response.json()
        if (!response.ok){
            await updateRequestRecord(initialRecord.id, { checkbook_response: responseBody, status: "SUBMISSION_FAILED"})
            await createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, responseBody.message, responseBody)

            const { message, type } = getMappedError(responseBody.error)
            throw new CreateFiatToCryptoTransferError(type, message, responseBody)
        }
        const toUpdate = {
            checkbook_response: responseBody,
            status: "FIAT_SUBMITTED",
            checkbook_payment_id: responseBody.id,
            checkbook_status: responseBody.status
        }

        if (process.env.NODE_ENV === "development"){
            toUpdate.status = "CONFIRMED"
            toUpdate.checkbook_status = "PAID"
        }

        const updatedRecord = await updateRequestRecord(initialRecord.id, toUpdate);

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