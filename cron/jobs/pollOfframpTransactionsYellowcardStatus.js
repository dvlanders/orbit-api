

const updateStatusWithYellowcardTransferId = async (transaction) => {

}

async function pollOfframpTransactionsYellowcardStatus() {
    const { data: offrampTransactionData, error: offrampTransactionError } = await supabase
		.from('offramp_transactions')
		.update({ updated_at: new Date().toISOString() })
		.eq("fiat_provider", "YLLOWCARD")
		.eq("transaction_status", "COMPLETED_ONCHAIN")
		.order('updated_at', { ascending: true })
		.select('*')

	if (offrampTransactionError) {
		console.error('Failed to fetch transactions for pollOfframpTransactionsYellowcardStatus', offrampTransactionError);
		await createLog('pollOfframpTransactionsYellowcardStatus', null, 'Failed to fetch transactions', offrampTransactionError);
		return;
	}

	// For each transaction, get the latest status from the Bridge API and update the db
	await Promise.all(offrampTransactionData.map(async (transaction) => {
		await updateStatusWithYellowcardTransferId(transaction)
	}))
}

module.exports = pollOfframpTransactionsYellowcardStatus;