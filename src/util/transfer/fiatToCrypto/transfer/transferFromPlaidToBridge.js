const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { transferType } = require("../../utils/transfer");
const bridgePlaidRailCheck = require("../railCheck/bridgePlaidRailCheck");
const { getLastBridgeVirtualAccountActivity } = require("../utils/getLastBridgeVirtualAccountActivity");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../utils/utils");
const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const transferFromPlaidToBridge = async(requestId, amount, sourceCurrency, destinationCurrency, chain, sourceAccountId, isInstant, sourceUserId, destinationUserId) => {
    try{
        const transferInfo = await bridgePlaidRailCheck(sourceAccountId, sourceCurrency, destinationCurrency, chain, sourceUserId, destinationUserId)
        // get the last virtual account activity
        const lastBridgeVirtualAccountActivity = await getLastBridgeVirtualAccountActivity(destinationUserId, transferInfo.bridge_virtual_account_id)
        // insert record
        const {data: initialRecord, error: initialRecordError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .insert({
                request_id: requestId,
                user_id: sourceUserId,
                destination_user_id: destinationUserId,
                amount: amount,
                plaid_checkbook_id: transferInfo.plaid_checkbook_id,
                bridge_virtual_account_id: transferInfo.bridge_virtual_account_id,
                destination_checkbook_user_id: transferInfo.recipient_checkbook_user_id,
                last_bridge_virtual_account_event_id: lastBridgeVirtualAccountActivity,
                status: "CREATED",
                fiat_provider: "CHECKBOOK",
                crypto_provider: "BRIDGE"
            })
            .select()
            .single())
        if (initialRecordError) {
            createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, initialRecordError.message)
            throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, initialRecordError.message)
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
            const {data, error} = await supabase
                .from("onramp_transactions")
                .update({
                    checkbook_response: responseBody,
                    status: "SUBMISSION_FAILED"
                })
                .eq("id", initialRecord.id)
            createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, responseBody.message, responseBody)
            throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
        }
        // update record
        const {data: updatedRecord, error: updatedRecordError} = await supabaseCall(() => supabase
            .from("onramp_transactions")
            .update({
                checkbook_response: responseBody,
                status: "FIAT_SUBMITTED",
                checkbook_payment_id: responseBody.id,
                checkbook_status: responseBody.status
            })
            .eq("id", initialRecord.id)
            .select()
            .single())
        
        if (updatedRecordError) {
            createLog("transfer/utils/transferFromPlaidToBridge", sourceUserId, updatedRecordError.message)
            throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, updatedRecordError.message)
        } 

        if (isInstant){
            // perform instant crypto transfer
        }

        const result = {
            transferType: transferType.FIAT_TO_CRYPTO,
            transferDetails: {
                id: initialRecord.id,
                requestId,
                sourceUserId,
                destinationUserId,
                chain,
                sourceCurrency,
                amount,
                destinationCurrency,
                sourceAccountId,
                createdAt: updatedRecord.created_at,
                status: "FIAT_SUBMITTED",
                isInstant,
            }
        }

        return result

    }catch (error){
        if (! (error instanceof CreateFiatToCryptoTransferError)){
            createLog("transfer/util/transferFromPlaidToBridge", sourceUserId, error.message)
        }
        throw error
    }

}

module.exports = transferFromPlaidToBridge