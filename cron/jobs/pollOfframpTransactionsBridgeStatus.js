const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const notifyDeveloperCryptoToFiatWithdraw = require('../../webhooks/transfer/notifyDeveloperCryptoToFiatWithdraw');
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const hifiOfframpTransactionStatusMap = {
	"in_review": "IN_PROGRESS_FIAT",
	"funds_received": "IN_PROGRESS_FIAT",
	'payment_submitted': 'INITIATED_FIAT',
	'payment_processed': 'COMPLETED',
	'returned': 'FAILED_FIAT_RETURNED',
	'refunded': 'FAILED_FIAT_REFUNDED',
	'error': 'FAILED_UNKNOWN',
	'canceled': "CANCELED"
}

const updateStatusWithBridgeTransferId = async (transaction) => {

	try {
		const response = await fetch(`${BRIDGE_URL}/v0/transfers/${transaction.bridge_transfer_id}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		const data = await response.json();
		if (!response.ok) {
			await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to fetch response from bridge', response);
			return
		}

		if (transaction.bridge_transaction_status == data.state) return

		// Map the data.state to our transaction_status
		const hifiOfframpTransactionStatus = hifiOfframpTransactionStatusMap[data.state] || "UNKNOWN"

		if (hifiOfframpTransactionStatus == transaction.transaction_status) return

		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('offramp_transactions')
			.update({
				transaction_status: hifiOfframpTransactionStatus,
				bridge_transaction_status: data.state,
				bridge_response: data,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select()
			.single()
		)

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to update transaction status', updateError);
			return
		}

		// send webhook message
		if (transaction.transfer_from_wallet_type == "FEE_COLLECTION") {
			await notifyDeveloperCryptoToFiatWithdraw(updateData)
		} else if (transaction.transfer_from_wallet_type == "INDIVIDUAL") {
			await notifyCryptoToFiatTransfer(updateData)
		}

	} catch (error) {
		console.error('Failed to fetch transaction status from Bridge API', error);
		await createLog('pollOfframpTransactionsBridgeStatus/updateStatusWithBridgeTransferId', transaction.user_id, 'Failed to fetch transaction status from Bridge API', error);
	}
}


const updateStatus = async (transaction) => {
	if (!transaction.to_bridge_liquidation_address_id) return
	const { data: destnationBridgeCustomerData, error: destnationBridgeCustomerDataError } = await supabaseCall(() => supabase
		.from('bridge_customers')
		.select('bridge_id')
		.eq('user_id', transaction.destination_user_id)
		.single()
	)

	if (destnationBridgeCustomerDataError) {
		console.error('Failed to fetch a single bridge id for the given user id', destnationBridgeCustomerDataError);
		await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch a single bridge id for the given user id', destnationBridgeCustomerDataError);
		return;
	}

	try {
		const response = await fetch(`${BRIDGE_URL}/v0/customers/${destnationBridgeCustomerData.bridge_id}/liquidation_addresses/${transaction.to_bridge_liquidation_address_id}/drains`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		const responseBody = await response.json();
		if (!response.ok) {
			await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch response from bridge', responseBody);
			return
		}

		const data = responseBody.data.find(item => item.deposit_tx_hash == transaction.transaction_hash);
		if (data === undefined) return
		if (transaction.bridge_transaction_status == data.state) return

		// Map the data.state to our transaction_status
		const hifiOfframpTransactionStatus =
			data.state === 'in_review' || data.state === 'funds_received' ? 'IN_PROGRESS_FIAT' :
				data.state === 'payment_submitted' ? 'INITIATED_FIAT' :
					data.state === 'payment_processed' ? 'COMPLETED' :
						data.state === 'returned' ? 'FAILED_FIAT_RETURNED' :
							data.state === 'refunded' ? 'FAILED_FIAT_REFUNDED' :
								data.state === 'error' ? 'FAILED_UNKNOWN' :
									'UNKNOWN';

		if (hifiOfframpTransactionStatus == transaction.transaction_status) return

		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('offramp_transactions')
			.update({
				transaction_status: hifiOfframpTransactionStatus,
				bridge_transaction_status: data.state,
				bridge_response: data,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select()
			.single()
		)

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to update transaction status', updateError);
			return
		}

		console.log('Updated transaction status for transaction ID', transaction.id, 'to', hifiOfframpTransactionStatus);
		// send webhook message
		if (transaction.transfer_from_wallet_type == "FEE_COLLECTION") {
			await notifyDeveloperCryptoToFiatWithdraw(updateData)
		} else if (transaction.transfer_from_wallet_type == "INDIVIDUAL") {
			await notifyCryptoToFiatTransfer(updateData)
		}

	} catch (error) {
		console.error('Failed to fetch transaction status from Bridge API', error);
		await createLog('pollOfframpTransactionsBridgeStatus/updateStatus', transaction.user_id, 'Failed to fetch transaction status from Bridge API', error);
	}
}

async function pollOfframpTransactionsBridgeStatus() {

	// Get all records where the bridge_transaction_status is not 
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabase
		.from('offramp_transactions')
		.update({ updated_at: new Date().toISOString() })
		.eq("fiat_provider", "BRIDGE")
		.neq("transaction_status", "NOT_INITIATED")
		.neq("transaction_status", "CREATED")
		.neq("transaction_status", "FAILED_ONCHAIN")
		.neq("transaction_status", "FAILED_FIAT_REFUNDED")
		.neq("transaction_status", "SUBMITTED_ONCHAIN")
		.or('bridge_transaction_status.is.null,and(bridge_transaction_status.neq.payment_processed,bridge_transaction_status.neq.refunded,bridge_transaction_status.neq.error,bridge_transaction_status.neq.canceled)')
		.order('updated_at', { ascending: true })
		.select('id, user_id, transaction_status, to_bridge_liquidation_address_id, bridge_transaction_status, transaction_hash, destination_user_id, transfer_from_wallet_type, bridge_transfer_id')

	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsBridgeStatus', offrampTransactionError);
		await createLog('pollOfframpTransactionsBridgeStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bridge API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => {
		if (transaction.to_bridge_liquidation_address_id) {
			await updateStatus(transaction)
		} else if (transaction.bridge_transfer_id) {
			await updateStatusWithBridgeTransferId(transaction)
		}
	}))
}

module.exports = pollOfframpTransactionsBridgeStatus;
