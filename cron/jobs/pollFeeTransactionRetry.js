const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { chargeTransactionFee, syncTransactionFeeRecordStatus } = require('../../src/util/billing/fee/transactionFeeBilling');

const updateStatus = async (transaction) => {

	try {
		// console.log('Updating fee transaction status for id:', transaction.id);
		await syncTransactionFeeRecordStatus(transaction.transaction_id, transaction.transaction_type);
        await chargeTransactionFee(transaction.transaction_id, transaction.transaction_type);
	} catch (error) {
		await createLog('pollFeeTransactionRetry/updateStatus', null, `Failed to update fee transaction status for id:${transaction.id} `, error);
	}
}

async function pollFeeTransactionRetry() {
	try {
		const { data: feeTransactions, error: feeTransactionsError } = await supabaseCall(() => supabase
			.from('fee_transactions')
			.update({ updated_at: new Date().toISOString() })
			.or("status.eq.CREATED, status.eq.IN_PROGRESS")
			.order('updated_at', { ascending: true })
			.select('*')
		)

		if (feeTransactionsError) {
			console.error('Failed to fetch fee transactions for pollFeeTransactionRetry', feeTransactionsError);
			await createLog('pollFeeTransactionRetry', null, 'Failed to fetch fee transactions', feeTransactionsError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(feeTransactions.map(async (transaction) => await updateStatus(transaction)))
	} catch (error) {
		await createLog("pollFeeTransactionRetry", null, "Failed to poll fee transaction transfer status", error.message)
	}
}

module.exports = pollFeeTransactionRetry;