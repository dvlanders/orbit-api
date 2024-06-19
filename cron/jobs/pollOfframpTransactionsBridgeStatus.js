const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

async function pollOfframpTransactionsBridgeStatus() {
	console.log('Polling Bridge API for offramp transaction status updates...');

	// Get all records where the bridge_transaction_status is not 
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.select('id, user_id, transaction_status, to_bridge_liquidation_address_id, bridge_transaction_status')
		// .eq("bridge_transaction_status", "")
		.or('bridge_transaction_status.is.null,and(bridge_transaction_status.neq.payment_processed,bridge_transaction_status.neq.refunded)')
	)


	console.log('offrampTransactionData', offrampTransactionData);
	console.log('offrampTransactionError', offrampTransactionError);


	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsBridgeStatus', offrampTransactionError);
		createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bridge API and update the db
	for (const transaction of offrampTransactionData) {

		const { data: bridgeCustomerData, error: bridgeCustomerError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.select('bridge_id')
			.eq('user_id', transaction.user_id)
			.single()
		)
		console.log('bridgeCustomerData', bridgeCustomerData);
		console.log('bridgeCustomerError', bridgeCustomerError);

		if (bridgeCustomerError) {
			console.error('Failed to fetch a single bridge id for the given user id', bridgeCustomerError);
			createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to fetch a single bridge id for the given user id', bridgeCustomerError);
			return;
		}


		try {
			console.log('bridgeCustomerData.bridge_id', bridgeCustomerData.bridge_id);
			console.log('offrampTransactionData.to_bridge_liquidation_address_id', transaction.to_bridge_liquidation_address_id);


			const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeCustomerData.bridge_id}/liquidation_addresses/${transaction.to_bridge_liquidation_address_id}/drains`, {
				method: 'GET',
				headers: {
					'Api-Key': BRIDGE_API_KEY
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Error response:', errorData);
				return res.status(response.status).json({ error: 'Failed to fetch drain history' });
			}

			const data = await response.json();
			console.log('data', data);


			// Map the data.state to our transaction_status
			const hifiOfframpTransactionStatus =
				data.state === 'in_review' || data.state === 'funds_received' ? 'IN_PROGRESS_FIAT' :
					data.state === 'payment_submitted' ? 'INITIATED_FIAT' :
						data.state === 'payment_processed' ? 'COMPLETED' :
							data.state === 'returned' ? 'FAILED_FIAT_RETURNED' :
								data.state === 'refunded' ? 'FAILED_FIAT_REFUNDED' :
									data.state === 'error' ? 'FAILED_UNKNOWN' :
										'UNKNOWN';

			// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the transaction.bridge_transaction_status is different from the one redterned in the data.state, update the transaction_status
			// 
			if (hifiOfframpTransactionStatus !== transaction.transaction_status || transaction.bridge_transaction_status !== data.state) {
				const { data: updateData, error: updateError } = await supabaseCall(() => supabase
					.from('offramp_transactions')
					.update({
						transaction_status: hifiOfframpTransactionStatus,
						bridge_transaction_status: data.state
					})
					.eq('id', transaction.id)
				)

				if (updateError) {
					console.error('Failed to update transaction status', updateError);
					createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to update transaction status', updateError);
				} else {
					console.log('Updated transaction status for transaction ID', transaction.id, 'to', hifiOfframpTransactionStatus);
				}
			}
		} catch (error) {
			console.error('Failed to fetch transaction status from Bridge API', error);
			createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to fetch transaction status from Bridge API', error);
		}
	}
}

module.exports = pollOfframpTransactionsBridgeStatus;
