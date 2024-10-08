const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyFiatToCryptoTransfer = require("../../webhooks/transfer/notifyFiatToCryptoTransfer");
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const updateStatus = async (onrampTransaction) => {
	// get user api key
	let { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
		.from('checkbook_users')
		.select('api_key, api_secret')
		.eq("checkbook_user_id", onrampTransaction.destination_checkbook_user_id)
		.maybeSingle())

    if (checkbookUserError) {
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, checkbookUserError.message, checkbookUserError)
        return
    }
    if (!checkbookUser){
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, `No checkbook user found for onRamp record:  ${onrampTransaction.id}`)
        return
    }
    
    // pull up-to-date status
    const url = `${CHECKBOOK_URL}/check/${onrampTransaction.checkbook_payment_id}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `${checkbookUser.api_key}:${checkbookUser.api_secret}`, // use the api key of the checkbook user that received the payment
        },
    };

    const response = await fetch(url, options)
    const responseBody = await response.json()
    if (!response.ok) {
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, responseBody.message, responseBody)
        return
    }
    // map status
    let status
    if (responseBody.status == "PAID"){
        status = "FIAT_PROCESSED"
    }else if (responseBody.status == "IN_PROCESS"){
        status = "FIAT_SUBMITTED"
    }else if (responseBody.status == "REFUNDED"){
        status = "REFUNDED"
    }else{
        status = "UNKNOWN"
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, `Unable to processed status: ${responseBody.status}`, responseBody)
    }

	//update status
	const { data: update, error: updateError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.update({
			status,
			checkbook_status: responseBody.status,
			checkbook_response: responseBody,
			updated_at: new Date().toISOString()
		})
		.eq('id', onrampTransaction.id)
		.select("id, request_id, user_id, destination_user_id, bridge_virtual_account_id, amount, created_at, updated_at, status, checkbook_status, bridge_status, failed_reason, plaid_checkbook_id, fiat_provider, crypto_provider")
		.single())

	if (updateError) {
		await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, updateError.message)
		return
	}

    if (status != onrampTransaction.status){
        // send slack notification if failed
        if (status === "REFUNDED") {
            notifyTransaction(
                onrampTransaction.user_id,
                rampTypes.ONRAMP,
                onrampTransaction.id,
                {
                    prevTransactionStatus: onrampTransaction.status,
                    updatedTransactionStatus: update.status,
                    checkbookStatus: update.checkbook_status,
                    bridgeStatus: update.bridge_status,
                    failedReason: update.failed_reason,
                }
            );
        }

        await notifyFiatToCryptoTransfer(update)
    }

}


async function pollOnrampTransactionsCheckbookStatus() {

	// Get all records where the bridge_transaction_status is not 
	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('id, checkbook_payment_id, user_id, destination_checkbook_user_id, status')
        .eq('fiat_provider', "CHECKBOOK")
        .not('checkbook_payment_id', 'is', null)
        .or('status.eq.FIAT_SUBMITTED, checkbook_status.eq.IN_PROCESS')
        .order('updated_at', {ascending: true})
    )

	if (onRampTransactionStatusError) {
		console.error('Failed to fetch transactions for pollOnrampTransactionsCheckbookStatus', onRampTransactionStatusError);
		await createLog('pollOnrampTransactionsCheckbookStatus', null, onRampTransactionStatusError.message, onRampTransactionStatusError);
		return;
	}
	await Promise.all(onRampTransactionStatus.map(async (onrampTransaction) => await updateStatus(onrampTransaction)))

}

module.exports = pollOnrampTransactionsCheckbookStatus
