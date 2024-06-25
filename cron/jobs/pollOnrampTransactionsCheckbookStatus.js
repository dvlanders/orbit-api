const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;
const CHECKBOOK_CENTRAL_USER_API_KEY = process.env.CHECKBOOK_CENTRAL_USER_API_KEY
const CHECKBOOK_CENTRAL_USER_API_SECRET = process.env.CHECKBOOK_CENTRAL_USER_API_SECRET


async function pollOnrampTransactionsCheckbookStatus() {
    console.log('Polling checkbook API for onramp transaction status updates...');

	// Get all records where the bridge_transaction_status is not 
	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.select('id, checkbook_payment_id, user_id')
        .or('status.is.FIAT_SUBMITTED,checkbook_status.is.IN_PROCESS')
	)

	if (onRampTransactionStatusError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsBridgeStatus', onRampTransactionStatusError);
		createLog('pollOfframpTransactionsBridgeStatus', null, onRampTransactionStatusError.message);
		return;
	}

    for (const onrampTransaction of onRampTransactionStatus){
        // pull up-to-date status
        const url = `${CHECKBOOK_URL}/check/${onrampTransaction.checkbook_payment_id}`;
        const options = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `${CHECKBOOK_CENTRAL_USER_API_KEY}:${CHECKBOOK_CENTRAL_USER_API_SECRET}`, // use the api key of the checkbook user that received the payment
            },
        };

        const response = await fetch(url, options)
        const responseBody = await response.json()
        if (!response.ok) {
            createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, responseBody.message, responseBody)
            continue
        }

        // map status
        let status
        if (responseBody.status == "PAID"){
            status = "FIAT_PROCESSED"
        }else if (responseBody.status == "IN_PROCESS"){
            status = "FIAT_SUBMITTED"
        }else if (responseBody.status == "REFUNDED"){
            status = "FIAT_REFUNDED"
        }else{
            status = "UNKNOWN"
            createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, `Unable to processed status: ${responseBody.status}`, responseBody)
        }

        //update status
        const { data: update, error: updateError } = await supabase
        .from('onramp_transactions')
        .update({ 
            status,
            checkbook_status: responseBody.status,
            checkbook_response: responseBody
        })
        .eq('id', onrampTransaction.id)

        if (!updateError) {
            createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, updateError.message)
            continue
        }
        
        return

    }


}
