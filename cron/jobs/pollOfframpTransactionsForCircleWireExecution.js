const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch');
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { executeCircleWirePayout } = require('../../src/util/circle/endpoint/executeCircleWirePayout');



async function pollOfframpTransactionsForCircleWireExecution() {

	// This Supabase call retrieves all offramp transaction records where the fiat provider is "CIRCLE", the Bastion transaction status is "CONFIRMED", and the Circle response is null. It selects the transaction ID, currency, amount, and Circle account ID from these records and orders them by the "updated_at" timestamp in ascending order, ensuring the fetched data
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.select('id, user_id,destination_currency, amount, circle_account_id')
		.eq("fiat_provider", "CIRCLE")
		.eq("bastion_transaction_status", "CONFIRMED")
		.is("circle_response", null)
		.order('updated_at', { ascending: true })
	);


	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsForCircleWireExecution', offrampTransactionError);
		createLog('pollOfframpTransactionsForCircleWireExecution', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}


	// For each transaction, call executeCircleWirePayout
	await Promise.all(offrampTransactionData.map(async (transaction) => {
		const { id, user_id, destination_currency, amount, circle_account_id } = transaction;
		// FIXME: Uncomment the following line once we have the Circle prod keys and resolve the issue
		// const response = await executeCircleWirePayout(id, user_id, destination_currency, amount, circle_account_id);
	})
	)
}

module.exports = pollOfframpTransactionsForCircleWireExecution;
