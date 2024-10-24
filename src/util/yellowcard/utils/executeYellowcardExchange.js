const createLog = require('../../logger/supabaseLogger');
const { getBearerDid } = require('./getBearerDid');
const { pollYellowcardExchangeForOrder } = require('./pollYellowcardExchangeForOrder');
const { updateRequestRecord } = require('../../transfer/cryptoToBankAccount/utils/updateRequestRecord');

// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function executeYellowcardExchange(offrampTransactionRecord) {

	const { TbdexHttpClient, Order } = await import('@tbdex/http-client');

	const yellowcardTransactionRecord = offrampTransactionRecord.yellowcard_transaction_info;

	if (!yellowcardTransactionRecord) {
		console.error('No yellowcard transaction record');
		return { error: "An unexpected error occurred fetching transaction record." };
	}


	const bearerDid = await getBearerDid();

	const order = Order.create({
		metadata: {
			from: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.to,
			to: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,
			exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId,
			protocol: "1.0"
		}
	});

	await order.sign(bearerDid);

	try {
		await TbdexHttpClient.submitOrder(order);
	} catch (error) {
		console.error('Error submitting order:', error);
		await updateRequestRecord(offrampTransactionRecord.id, { transaction_status: "QUOTE_FAILED" });
		await createLog("transfer/util/executeYellowcardExchange", offrampTransactionRecord.user_id, "Error submitting order", error);
		return { error: `Order submission failed: ${error.message}`, statusCode: error.statusCode };
	}

	const { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord } = await pollYellowcardExchangeForOrder(order, offrampTransactionRecord, bearerDid);

	return { updatedOfframpTransactionRecord, updatedYellowcardTransactionRecord };
}


module.exports = {
	executeYellowcardExchange
};