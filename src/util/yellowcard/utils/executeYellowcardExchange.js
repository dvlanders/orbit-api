const createLog = require('../../logger/supabaseLogger');
const { supabaseCall } = require('../../supabaseWithRetry');
const supabase = require('../../supabaseClient');
const { getBearerDid } = require('./getBearerDid');

// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function executeYellowcardExchange(yellowcardTransactionId) {

	const { TbdexHttpClient, Order, OrderStatus, Close, Message } = await import('@tbdex/http-client');

	// get the yellowcard transaction record
	const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabaseCall(() => supabase
		.from('yellowcard_transactions')
		.select('*')
		.eq('id', yellowcardTransactionId)
		.maybeSingle())

	if (yellowcardTransactionError || !yellowcardTransactionRecord) {
		console.error('Error fetching yellowcard transaction record:', yellowcardTransactionError);
		return res.status(500).json({ error: "An unexpected error occurred" });
	}

	// get the centralized HIFI bearerDid that has the signed Yellowcard VC credential issued against it
	const bearerDid = await getBearerDid();

	// create order object
	const order = Order.create({
		metadata: {
			// Note the reversal of the from / to fields is intentional. The rfq response is FROM yellowcard TO HIFI.
			from: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.to, // HIFI's DID
			to: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,// Yellowcards's DID
			exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId,
			protocol: "1.0"                // Version of tbDEX protocol
		}
	});


	await order.sign(bearerDid);

	console.log('order:', order);
	try {
		await TbdexHttpClient.submitOrder(order);

	} catch (error) {
		console.error('Error submitting order:', error);

		// handle the case when the quote is expired
		if (error.sstatusCode === 410) {
			throw new Error('Quote has expired');
		}

	}

	let orderStatusUpdate;
	let orderClose;

	while (!orderClose) {
		const exchange = await TbdexHttpClient.getExchange({
			pfiDid: order.metadata.to,
			did: bearerDid,
			exchangeId: order.exchangeId
		});

		for (const message of exchange) {
			if (message instanceof OrderStatus) {
				// a status update to display to your customer
				orderStatusUpdate = message.data.orderStatus;
			}
			else if (message instanceof Close) {
				// final message of exchange has been written
				orderClose = message;
				break;
			}
		}
	}


	return orderClose;
}


module.exports = {
	executeYellowcardExchange
}