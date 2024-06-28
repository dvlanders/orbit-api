const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const updateStatus = async (onrampTransaction) => {
	// get user api key
	let { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
		.from('checkbook_users')
		.select('api_key, api_secret')
		.eq("checkbook_user_id", onrampTransaction.destination_checkbook_user_id)
		.maybeSingle())

	if (checkbookUserError) {
		createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, checkbookUserError.message)
	}
	if (!checkbookUser) {
		createLog("pollOnrampTransactionsCheckbookStatus", `No checkbook user found for onRamp record:  ${onrampTransaction.id}`)
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
		createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, responseBody.message, responseBody)
	}
	// map status
	let status
	if (responseBody.status == "PAID") {
		status = "FIAT_PROCESSED"
	} else if (responseBody.status == "IN_PROCESS") {
		status = "FIAT_SUBMITTED"
	} else if (responseBody.status == "REFUNDED") {
		status = "REFUNDED"
	} else {
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
	}
}


async function pollOnrampTransactionsCheckbookStatus() {

	// Get all records where the bridge_transaction_status is not 
	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('id, checkbook_payment_id, user_id, destination_checkbook_user_id')
		.or('status.eq.FIAT_SUBMITTED,checkbook_status.eq.IN_PROCESS')
	)

	if (onRampTransactionStatusError) {
		console.error('Failed to fetch transactions for pollOnrampTransactionsCheckbookStatus', onRampTransactionStatusError);
		createLog('pollOnrampTransactionsCheckbookStatus', null, onRampTransactionStatusError.message);
		return;
	}
	await Promise.all(onRampTransactionStatus.map(async (onrampTransaction) => await updateStatus(onrampTransaction)))

}

module.exports = pollOnrampTransactionsCheckbookStatus
