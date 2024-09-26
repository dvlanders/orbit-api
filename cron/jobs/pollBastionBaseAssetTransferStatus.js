const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { safeParseBody } = require("../../src/util/utils/response");
const notifyBaseAssetWithdraw = require("../../webhooks/transfer/notifyBaseAssetWithdraw");
const notifyCryptoToCryptoTransfer = require("../../webhooks/transfer/notifyCryptoToCryptoTransfer");
const { BASTION_URL, BASTION_API_KEY } = process.env;


const updateStatus = async (transaction) => {
	const url = `${BASTION_URL}/v1/crypto/transfers/${transaction.bastion_request_id}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await safeParseBody(response)

		if (!response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${transaction.bastion_request_id}`;
			await createLog('pollBastionBaseAssetTransferStatus/updateStatus', transaction.sender_user_id, errorMessage, data);
			return
		}
		if (data.status == transaction.status) return
		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('base_asset_transactions')
			.update({
				status: data.status,
				bastion_status: data.status,
				bastion_response: data,
				updated_at: new Date().toISOString(),
				transaction_hash: data.transactionHash
			})
			.eq('id', transaction.id)
			.select("*")
			.single())

		if (updateError) {
			await createLog('pollBastionBaseAssetTransferStatus/updateStatus', transaction.sender_user_id, 'Failed to update transaction status', updateError);
			return
		}

		await notifyBaseAssetWithdraw(updateData)


	} catch (error) {
		await createLog('pollBastionBaseAssetTransferStatus/updateStatus', transaction.sender_user_id, 'Failed to update transaction status', error);
	}
}



async function pollBastionBaseAssetTransferStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: baseAssetTransactionData, error: baseAssetTransactionDataError } = await supabaseCall(() => supabase
			.from('base_asset_transactions')
			.update({ updated_at: new Date().toISOString() })
			.eq('crypto_provider', "BASTION")
			.or("status.eq.SUBMITTED,status.eq.ACCEPTED,status.eq.PENDING")
			.order('updated_at', { ascending: true })
			.select('*')
		)

		if (baseAssetTransactionDataError) {
			await createLog('pollBastionBaseAssetTransferStatus', null, 'Failed to fetch transactions', baseAssetTransactionDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(baseAssetTransactionData.map(async (transaction) => await updateStatus(transaction)))
	} catch (error) {
		await createLog("pollBastionBaseAssetTransferStatus", null, "Failed to poll Bastion base asset transfer status", error.message)
	}
}

module.exports = pollBastionBaseAssetTransferStatus;