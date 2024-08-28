const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const notifyDeveloperCryptoToFiatWithdraw = require('../../webhooks/transfer/notifyDeveloperCryptoToFiatWithdraw');
const { blindpayPayoutStatusMap } = require('../../src/util/blindpay/endpoint/utils');

const updateStatusWithBlindpayTransferId = async (transaction) => {
	console.log("polling blindpay payout status for transaction", transaction)
	try {
		const headers = {
			Accept: "application/json",
			Authorization: `Bearer ${process.env.BLINDPAY_API_KEY}`,
			"Content-Type": "application/json",
		  };

		const response = await fetch(
		`${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/payouts/${transaction.blindpay_payout_id}`,
		{
			method: "GET",
			headers: headers,
		}
		);

		const payoutResponseBody = await response.json();
		if (!response.ok) {
			await createLog('pollOfframpTransactionsBlindpayStatus/updateStatusWithBlindpayTransferId', transaction.user_id, 'Failed to fetch response from Blindpay', response);
			return
		}

		if (transaction.blindpay_payout_status == payoutResponseBody.status) return

		// Map the data.state to our transaction_status
		const hifiOfframpTransactionStatus = blindpayPayoutStatusMap[payoutResponseBody.status] || "UNKNOWN"
		
		if (hifiOfframpTransactionStatus == transaction.transaction_status) return
		
		console.log("updating payout transaction status", payoutResponseBody)
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('offramp_transactions')
			.update({
				transaction_status: hifiOfframpTransactionStatus,
				blindpay_payout_status: payoutResponseBody.status,
				blindpay_payout_response: payoutResponseBody,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select()
			.single()
		)

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollOfframpTransactionsBlindpayStatus/updateStatusWithBlindpayTransferId', transaction.user_id, 'Failed to update transaction status', updateError);
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
		await createLog('pollOfframpTransactionsBlindpayStatus/updateStatusWithBlindpayTransferId', transaction.user_id, 'Failed to fetch transaction status from Blindpay API', error);
	}
}

async function pollOfframpTransactionsBlindpayStatus() {

	const { data: offrampTransactionData, error: offrampTransactionError } = await supabase
		.from('offramp_transactions')
		.update({ updated_at: new Date().toISOString() })
		.eq("fiat_provider", "BLINDPAY")
		.eq("transaction_status", "IN_PROGRESS_FIAT")
		.order('updated_at', { ascending: true })
		.select('id, user_id, transaction_status, blindpay_payout_status, blindpay_payout_id, transfer_from_wallet_type')

	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsBlindpayStatus', offrampTransactionError);
		await createLog('pollOfframpTransactionsBlindpayStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bridge API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => {
		await updateStatusWithBlindpayTransferId(transaction)
	}))
}

module.exports = pollOfframpTransactionsBlindpayStatus;
