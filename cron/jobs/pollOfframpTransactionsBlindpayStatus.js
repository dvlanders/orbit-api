const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { blindpayPayoutStatusMap } = require('../../src/util/blindpay/endpoint/utils');
const { getPayout } = require('../../src/util/blindpay/endpoint/getPayout');
const { updateRequestRecord } = require('../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord');
const { updateBlinpdayTransactionInfo } = require('../../src/util/blindpay/transactionInfoService');

const updateStatusWithBlindpayTransferId = async (transaction) => {
	// console.log("polling blindpay payout status for transaction", transaction)
	try {
		const blindpayTransactionInfo = transaction.blindpay_transaction_info;
		const payoutResponseBody = await getPayout(blindpayTransactionInfo.payout_id)
		if (blindpayTransactionInfo.payout_status == payoutResponseBody.status) return

		// Map the data.state to our transaction_status
		const hifiOfframpTransactionStatus = blindpayPayoutStatusMap[payoutResponseBody.status] || "UNKNOWN"
		
		if (hifiOfframpTransactionStatus == transaction.transaction_status) return
		
		// console.log("updating payout transaction status", payoutResponseBody)

		const toUpdateBlindpay = {
			payout_status: payoutResponseBody.status,
			payout_response: payoutResponseBody,
		}
		await updateBlinpdayTransactionInfo(transaction.blindpay_info_id, toUpdateBlindpay);

		const toUpdateRequest = {
			transaction_status: hifiOfframpTransactionStatus,
			updated_at: new Date().toISOString()
		}
		const updateData = await updateRequestRecord(transaction.id, toUpdateRequest);

		// send webhook message
		await notifyCryptoToFiatTransfer(updateData)

	} catch (error) {
		console.error('Failed to fetch transaction status from Blindpay API', error);
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
		.select('id, user_id, transaction_status, transfer_from_wallet_type, blindpay_info_id, blindpay_transaction_info:blindpay_info_id (*)')

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
