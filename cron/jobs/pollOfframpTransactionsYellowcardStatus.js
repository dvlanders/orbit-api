const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { getBearerDid } = require('../../src/util/yellowcard/utils/getBearerDid');

const hifiOfframpTransactionStatusMap = {
	"processing": "IN_PROGRESS_FIAT",
	'pending': 'IN_PROGRESS_FIAT',
	'complete': 'COMPLETED',
	'failed': 'FAILED_FIAT_RETURNED'
}

const updateStatusWithYellowcardTransferId = async (transaction) => {
    const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabase
		.from('yellowcard_transactions')
		.select('*')
		.eq('id', transaction.yellowcard_transaction_id)
		.maybeSingle();

    if (yellowcardTransactionError || !yellowcardTransactionRecord) {
        console.error('Error fetching yellowcard transaction record:', yellowcardTransactionError);
        return { error: "An unexpected error occurred fetching transaction record." };
    }

    const bearerDid = await getBearerDid();

    // fetch exchange
    const { OrderStatus } = await import('@tbdex/http-server');
    const { TbdexHttpClient } = await import('@tbdex/http-client');
    const exchange = await TbdexHttpClient.getExchange({
        pfiDid: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.from,
        did: bearerDid,
        exchangeId: yellowcardTransactionRecord.yellowcard_rfq_response.metadata.exchangeId
    });

    const close = exchange.find(message => message.kind === 'close');

    let closed_reason, hifiOfframpTransactionStatus;
    if (close) {
        hifiOfframpTransactionStatus = close.data.success ? "COMPLETED" : "FAILED_FIAT_RETURNED";
        closed_reason = close.data.reason;
    } else {
        const latestMessage = exchange[exchange.length - 1];
        if (latestMessage instanceof OrderStatus) {
            hifiOfframpTransactionStatus = hifiOfframpTransactionStatusMap[latestMessage.data.orderStatus];
        }
    }

    if (!hifiOfframpTransactionStatus || hifiOfframpTransactionStatus === transaction.transaction_status)
        return;

    const { data: updateData, error: updateError } = await supabase
        .from('offramp_transactions')
        .update({
            transaction_status: hifiOfframpTransactionStatus,
            updated_at: new Date().toISOString(),
            failed_reason: hifiOfframpTransactionStatus === "FAILED_FIAT_RETURNED" ? undefined : closed_reason,
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