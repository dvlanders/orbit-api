const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY } = process.env;


const updateStatus = async (transaction) => {
	const url = `${BASTION_URL}/v1/user-actions/${transaction.bastion_request_id}?userId=${transaction.sender_user_id}`;
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

		if (response.status === 404 || !response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			console.error(errorMessage);
			createLog('pollCryptoToCryptoTransferStatus/updateStatus', null, errorMessage);
			return
		}
		if (data.status == transaction.status) return
		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('crypto_to_crypto')
			.update({
				status: data.status,
				bastion_response: data,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select()
			.single())

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			createLog('pollOfframpTransactionsBastionStatus/updateStatus', null, 'Failed to update transaction status', updateError);
			return
		}

		console.log('Updated transaction status for transaction ID', transaction.id, 'to', data.status);
		await notifyCryptoToCryptoTransfer(updateData)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		createLog('pollOfframpTransactionsBastionStatus/updateStatus', null, 'Failed to fetch transaction status from Bastion API', error);
	}
}



async function pollBastionCryptoToCryptoTransferStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: cryptoTransactionData, error: cryptoTransactionDataError } = await supabaseCall(() => supabase
			.from('crypto_to_crypto')
			.select('*')
			.eq('provider', "BASTION")
			.neq('status', BastionTransferStatus.CONFIRMED)
			.neq('status', BastionTransferStatus.FAILED)
			.neq('status', "CREATED")
			.order('updated_at', { ascending: true })
		)


		if (cryptoTransactionDataError) {
			console.error('Failed to fetch transactions for pollCryptoToCryptoTransferStatus', cryptoTransactionDataError);
			createLog('pollCryptoToCryptoTransferStatus', null, 'Failed to fetch transactions', cryptoTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(cryptoTransactionData.map(async (transaction) => await updateStatus(transaction)))
	} catch (error) {
		createLog("pollOfframpTransactionsBastionStatus", null, error.message)
	}
}

module.exports = pollBastionCryptoToCryptoTransferStatus;