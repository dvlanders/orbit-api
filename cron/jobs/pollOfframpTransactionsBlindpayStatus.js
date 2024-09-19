const { supabaseCall } = require('../../src/util/supabaseWithRetry');
const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { blindpayPayoutStatusMap } = require('../../src/util/blindpay/endpoint/utils');
const { getPayout } = require('../../src/util/blindpay/endpoint/getPayout');
const { updateRequestRecord } = require('../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord');
const { chargeTransactionFee, syncTransactionFeeRecordStatus } = require('../../src/util/billing/fee/transactionFeeBilling');
const { transferType } = require("../../src/util/transfer/utils/transfer");

const updateStatusWithBlindpayTransferId = async (transaction) => {
	// console.log("polling blindpay payout status for transaction", transaction)
	try {
		const payoutResponseBody = await getPayout(transaction.blindpay_payout_id)
		if (transaction.blindpay_payout_status == payoutResponseBody.status) return

		// Map the data.state to our transaction_status
		const hifiOfframpTransactionStatus = blindpayPayoutStatusMap[payoutResponseBody.status] || "UNKNOWN"
		
		if (hifiOfframpTransactionStatus == transaction.transaction_status) return
		
		// console.log("updating payout transaction status", payoutResponseBody)

		const toUpdate = {
			transaction_status: hifiOfframpTransactionStatus,
			blindpay_payout_status: payoutResponseBody.status,
			blindpay_payout_response: payoutResponseBody,
			updated_at: new Date().toISOString()			
		}
		const updateData = await updateRequestRecord(transaction.id, toUpdate);

		if(hifiOfframpTransactionStatus === "COMPLETED"){
			await chargeTransactionFee(transaction.id, transferType.CRYPTO_TO_FIAT);
		}else{
			await syncTransactionFeeRecordStatus(transaction.id, transferType.CRYPTO_TO_FIAT);
		}
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
