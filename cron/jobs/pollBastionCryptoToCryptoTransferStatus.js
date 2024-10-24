const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY } = process.env;
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");


const updateStatus = async (transaction) => {
	const bastionUserId = transaction.sender_bastion_user_id
	const url = `${BASTION_URL}/v1/user-actions/${transaction.bastion_request_id}?userId=${bastionUserId}`;
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
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${transaction.bastion_request_id}`;
			console.error(errorMessage);
			await createLog('pollCryptoToCryptoTransferStatus/updateStatus', transaction.sender_user_id, errorMessage, data);
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
			.select("*")
			.single())

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, 'Failed to update transaction status', updateError);
			return
		}

		if (transaction.developer_fee_id) {
			// update fee charged
			const { data: updateFeeData, error: updateFeeError } = await supabaseCall(() => supabase
				.from('developer_fees')
				.update({
					charged_status: data.status,
					bastion_status: data.status,
					bastion_response: data,
					updated_at: new Date().toISOString()
				})
				.eq('id', transaction.developer_fee_id)
				.select()
				.single())

			if (updateFeeError) {
				console.error('Failed to update fee status', updateError);
				await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, 'Failed to update fee status', updateError);
				return
			}
		}
        
        // send slack notification if failed
        if (updateData.status === 'FAILED') {
            notifyTransaction(
                transaction.sender_user_id,
                rampTypes.CRYPTOTOCRYPTO,
                transaction.id,
                {
                    prevTransactionStatus: transaction.status,
                    updatedTransactionStatus: updateData.status,
                    failedReason: updateData.failed_reason,
                }
            );
        }
		await notifyCryptoToCryptoTransfer(updateData)


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.sender_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}



async function pollBastionCryptoToCryptoTransferStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: cryptoTransactionData, error: cryptoTransactionDataError } = await supabaseCall(() => supabase
			.from('crypto_to_crypto')
			.update({ updated_at: new Date().toISOString() })
			.eq('provider', "BASTION")
			.or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
			.order('updated_at', { ascending: true })
			.select('*')
		)

		if (cryptoTransactionDataError) {
			console.error('Failed to fetch transactions for pollCryptoToCryptoTransferStatus', cryptoTransactionDataError);
			await createLog('pollCryptoToCryptoTransferStatus', null, 'Failed to fetch transactions', cryptoTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(cryptoTransactionData.map(async (transaction) => await updateStatus(transaction)))
	} catch (error) {
		await createLog("pollBastionCryptoToCryptoTransferStatus", null, "Failed to poll Bastion crypto to crypto transfer status", error.message)
	}
}

module.exports = pollBastionCryptoToCryptoTransferStatus;