const createLog = require('../../logger/supabaseLogger');
const { getBearerDid } = require('./getBearerDid');
const { pollYellowcardExchangeForOrder } = require('./pollYellowcardExchangeForOrder');
const { updateRequestRecord } = require('../../transfer/cryptoToBankAccount/utils/updateRequestRecord');
const { updateOfframpTransactionRecord } = require('../../transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
const notifyCryptoToFiatTransfer = require('../../../../webhooks/transfer/notifyCryptoToFiatTransfer');

// Fetches offerings from a specific PFI and returns a selected offering based on currency pair.
async function executeYellowcardExchange(offrampTransactionRecord) {

	const { TbdexHttpClient, Rfq, Quote, Order, OrderStatus, Close, OrderInstructions } = await import('@tbdex/http-client');

	const yellowcardTransactionRecord = offrampTransactionRecord.yellowcard_transaction_info;
	if (!yellowcardTransactionRecord) {
		await createLog("transfer/yellowcard/executeYellowcardExchange", offrampTransactionRecord.user_id, "No yellowcard transaction record")
		const toUpdateOfframpRecord = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Unable to process transaction, please reach out for more information",
			updated_at: new Date().toISOString()
		}
		await updateOfframpTransactionRecord(offrampTransactionRecord.id, toUpdateOfframpRecord);
		notifyCryptoToFiatTransfer(offrampTransactionRecord)
		throw new Error("No yellowcard transaction record")
	}

	// create order
	const bearerDid = await getBearerDid();
	const order = Order.create({
		metadata: {
			from: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.to,
			to: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,
			exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId,
			protocol: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.protocol
		}
	});

	// sign order
	await order.sign(bearerDid);

	// submit order
	try {
		await TbdexHttpClient.submitOrder(order);
	} catch (error) {
		await createLog("transfer/util/executeYellowcardExchange", offrampTransactionRecord.user_id, error.message, error)
		const toUpdateOfframpRecord = {
			transaction_status: "NOT_INITIATED",
			failed_reason: "Unable to submit order, please try to submit a new transaction",
			updated_at: new Date().toISOString()
		}
		await updateOfframpTransactionRecord(offrampTransactionRecord.id, toUpdateOfframpRecord);
		notifyCryptoToFiatTransfer(offrampTransactionRecord)
		throw new Error("Failed to submit yellowcard order")
	}

	return {order, bearerDid}
}


module.exports = {
	executeYellowcardExchange
};