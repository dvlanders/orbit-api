const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const { BastionTransferStatus } = require('../../src/util/bastion/utils/utils');
const { createLog } = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const { BASTION_URL, BASTION_API_KEY } = process.env;

const updateStatus = async (transaction) => {
	const url = `${BASTION_URL}/v1/user-actions/${transaction.id}?userId=${transaction.user_id}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		console.log('data', data);

		if (response.status === 404 || !response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			console.error(errorMessage);
			createLog('pollOfframpTransactionsBastionStatus', null, errorMessage);
			return
		}

		// Map the data.status to our transaction_status
		const hifiOfframpTransactionStatus =
			data.status === 'ACCEPTED' || data.status === 'SUBMITTED' ? 'SUBMITTED_ONCHAIN' :
				data.status === 'CONFIRMED' ? 'COMPLETED_ONCHAIN' :
					data.status === 'FAILED' ? 'FAILED_ONCHAIN' :
						'UNKNOWN';

		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		if (hifiOfframpTransactionStatus !== transaction.transaction_status || data.status !== transaction.bastion_transaction_status) {
			const { data: updateData, error: updateError } = await supabaseCall(() => supabase
				.from('offramp_transactions')
				.update({
					transaction_status: hifiOfframpTransactionStatus,
					bastion_transaction_status: data.status
				})
				.eq('id', transaction.id)
			)

			if (updateError) {
				console.error('Failed to update transaction status', updateError);
				createLog('pollOfframpTransactionsBastionStatus', null, 'Failed to update transaction status', updateError);
			} else {
				console.log('Updated transaction status for transaction ID', transaction.id, 'to', hifiOfframpTransactionStatus);
			}
		}
	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		createLog('pollOfframpTransactionsBastionStatus', null, 'Failed to fetch transaction status from Bastion API', error);
	}
}

async function pollOfframpTransactionsBastionStatus() {

	// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.select('id, user_id, transaction_status, bastion_transaction_status')
		.neq('bastion_transaction_status', BastionTransferStatus.CONFIRMED)
		.neq('bastion_transaction_status', BastionTransferStatus.FAILED)
	)


	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollBastionStatus', offrampTransactionError);
		createLog('pollOfframpTransactionsBastionStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bastion API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => await updateStatus(transaction)))
}

module.exports = pollOfframpTransactionsBastionStatus;
