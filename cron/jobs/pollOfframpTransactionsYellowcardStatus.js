const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { getBearerDid } = require('../../src/util/yellowcard/utils/getBearerDid');

const updateStatusWithYellowcardTransferId = async (transaction) => {
    const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabase
		.from('yellowcard_transactions')
		.select('*')
		.eq('id', offrampTransactionRecord.yellowcard_transaction_id)
		.maybeSingle();

    if (yellowcardTransactionError || !yellowcardTransactionRecord) {
        console.error('Error fetching yellowcard transaction record:', yellowcardTransactionError);
        return { error: "An unexpected error occurred fetching transaction record." };
    }

    const bearerDid = await getBearerDid();

    // fetch exchange
    const { TbdexHttpClient, Close } = await import('@tbdex/http-client');
    const exchange = await TbdexHttpClient.getExchange({
        pfiDid: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,
        did: bearerDid,
        exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId
    });

    let close;
    for (const message of exchange) {
        if (message instanceof Close) {
            close = message;
            break;
        }
    }

    if (!close) return;

    const hifiOfframpTransactionStatus = close.data.success ? "COMPLETED" : "FAILED_FIAT_RETURNED";

    const { data: updateData, error: updateError } = await supabase
        .from('offramp_transactions')
        .update({
            transaction_status: hifiOfframpTransactionStatus,
            updated_at: new Date().toISOString(),
            failed_reason: close.data.success ? undefined : close.data.reason,
        })
        .eq('id', transaction.id)
        .select()
        .single()
    
    if (updateError) {
        console.error('Failed to update transaction status', updateError);
        await createLog('pollOfframpTransactionsYellowcardStatus/updateStatusWithYellowcardTransferId', transaction.user_id, 'Failed to update transaction status', updateError);
        return
    }

    // send webhook message
    await notifyCryptoToFiatTransfer(updateData);
}

async function pollOfframpTransactionsYellowcardStatus() {
    const { data: offrampTransactionData, error: offrampTransactionError } = await supabase
		.from('offramp_transactions')
		.update({ updated_at: new Date().toISOString() })
		.eq("fiat_provider", "YELLOWCARD")
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