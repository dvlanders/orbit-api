const fetch = require('node-fetch');
const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");

const CIRCLE_URL = process.env.CIRCLE_URL;
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

const chainToCircleChainValue = process.env.NODE_ENV === "development" ?
	{
		"ETHEREUM_TESTNET": "ETH",
		"OPTIMISM_TESTNET": "OP",
		"POLYGON_AMOY": "POLY"
	} :
	{
		"ETHEREUM_MAINNET": "ETH",
		"OPTIMISM_MAINNET": "OP",
		"POLYGON_MAINNET": "POLY"
	};

const currencyToCircleChainValue = {
	"usd": "USD",
	"eur": "EUR"
};

const executeCircleWirePayout = async (id, user_id, destination_currency, amount, circle_account_id) => {


	try {
		const idempotencyKey = v4();
		const circlePayoutsUrlRequestBody = {
			"idempotencyKey": idempotencyKey,
			"destination": {
				"type": "wire",
				"id": circle_account_id
			},
			"amount": {
				"amount": amount,
				"currency": currencyToCircleChainValue[destination_currency]
			}
		};

		const headers = {
			'Accept': 'application/json',
			'Authorization': `Bearer ${CIRCLE_API_KEY}`,
			'Content-Type': 'application/json'
		};

		const circlePayoutsUrl = `${CIRCLE_URL}/businessAccount/payouts`;

		const circlePayoutsUrlResponse = await fetch(circlePayoutsUrl, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(circlePayoutsUrlRequestBody)
		});



		if (!circlePayoutsUrlResponse.ok) {
			const circlePayoutsUrlResponseBody = await circlePayoutsUrlResponse.json();
			// console.error('circlePayoutsUrlResponseBody', circlePayoutsUrlResponseBody); // FIXME: uncomment once we have the circle prod keys and we resolve this issue
			createLog("transfer/util/executeCircleWirePayout", user_id, circlePayoutsUrlResponseBody.message);
			return
		}

		const responseBody = await circlePayoutsUrlResponse.json();
		const { error: updateError } = await supabase
			.from('offramp_transactions')
			.update({
				circle_response: responseBody,
				circle_status: responseBody.data.status,
				circle_payout_id: responseBody.data.id
			})
			.eq('id', id);

		if (updateError) {
			createLog('transfer/util/executeCircleWirePayout', user_id, 'Failed to update transaction status', updateError);
			return
		}

		return {
			status: 200,
			message: "Payout successfully executed"
		};
	} catch (error) {
		console.error("Error in executeCircleWirePayout:", error);
		createLog("transfer/util/executeCircleWirePayout", user_id, error.message || "Unexpected error");
		return {
			status: error.status || 500,
			error: error.message || "An error occurred during the payout process"
		};
	}
};

module.exports = {
	executeCircleWirePayout
};
