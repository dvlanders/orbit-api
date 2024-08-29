const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const { BastionTransferStatus } = require('../../src/util/bastion/utils/utils');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const createLog = require('../../src/util/logger/supabaseLogger');
const notifyDeveloperCryptoToFiatWithdraw = require('../../webhooks/transfer/notifyDeveloperCryptoToFiatWithdraw');
const { executeBlindpayPayoutScheduleCheck } = require('../../asyncJobs/transfer/executeBlindpayPayout/scheduleCheck');
const createJob = require('../../asyncJobs/createJob');
const { BASTION_URL, BASTION_API_KEY } = process.env;

const updateStatus = async (transaction) => {
	console.log('Updating status for transaction ID', transaction.id);
	const bastionUserId = transaction.bastion_user_id
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
			await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, errorMessage, data);
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
					bastion_transaction_status: data.status,
					bastion_response: data,
					updated_at: new Date().toISOString()
				})
				.eq('id', transaction.id)
				.select()
				.single()
			)

			if (updateError) {
				console.error('Failed to update transaction status', updateError);
				await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, 'Failed to update transaction status', updateError);
				return
			}

			if (transaction.developer_fee_id){
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
					await createLog('pollOfframpTransactionsBastionStatus/updateStatus', transaction.user_id, 'Failed to update fee status', updateError);
					return
				}
			}

			console.log('Updated transaction status for transaction ID', transaction.id, 'to', hifiOfframpTransactionStatus);
			
			// if the on-chain transfer is completed, it means we can execute the payout for the Blindpay offramp
			if(hifiOfframpTransactionStatus === 'COMPLETED_ONCHAIN' && transaction.fiat_provider === "BLINDPAY"){
				console.log("Checking if we can schedule the Blindpay payout")
				const canSchedule = await executeBlindpayPayoutScheduleCheck("executeBlindpayPayout", { recordId: transaction.id }, transaction.user_id)
				if (canSchedule) {
					console.log("Scheduling the Blindpay payout")
					await createJob("executeBlindpayPayout", { recordId: transaction.id }, transaction.user_id, null)
				}
			}

			// send webhook message
			if (transaction.transfer_from_wallet_type == "FEE_COLLECTION"){
				await notifyDeveloperCryptoToFiatWithdraw(updateData)
			}else if (transaction.transfer_from_wallet_type == "INDIVIDUAL"){
				await notifyCryptoToFiatTransfer(updateData)
			}

		}
	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollOfframpTransactionsBastionStatus', transaction.user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

async function pollOfframpTransactionsBastionStatus() {
	console.log("pollOfframpTransactionsBastionStatus")
	// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
	const { data: offrampTransactionData, error: offrampTransactionError } = await supabaseCall(() => supabase
		.from('offramp_transactions')
		.update({updated_at: new Date().toISOString()})
		.eq("crypto_provider", "BASTION")
		.neq('bastion_transaction_status', BastionTransferStatus.CONFIRMED)
		.neq('bastion_transaction_status', BastionTransferStatus.FAILED)
		.not('bastion_transaction_status', 'is', null)
		.order('updated_at', { ascending: true })
		.select('id, user_id, transaction_status, bastion_transaction_status, bastion_request_id, developer_fee_id, transfer_from_wallet_type, bastion_user_id, fiat_provider')
	)


	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollBastionStatus', offrampTransactionError);
		await createLog('pollOfframpTransactionsBastionStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bastion API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => await updateStatus(transaction)))
}

module.exports = pollOfframpTransactionsBastionStatus;
