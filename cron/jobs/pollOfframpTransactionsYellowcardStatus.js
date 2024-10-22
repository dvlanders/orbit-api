const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { getBearerDid } = require('../../src/util/yellowcard/utils/getBearerDid');

const hifiOfframpTransactionStatusMap = {
	"PAYOUT_INITIATED": "IN_PROGRESS_FIAT",
	'PAYOUT_PENDING': 'IN_PROGRESS_FIAT',
	'PAYOUT_SETTLED': 'COMPLETED',
	'PAYIN_FAILED': 'FAILED_FIAT_RETURNED'
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

    let closedReason, hifiOfframpTransactionStatus;
    if (close) {
        closedReason = close.data.reason;
        hifiOfframpTransactionStatus = closedReason === "complete" ? "COMPLETED" : "FAILED_FIAT_RETURNED";
    } else {
        const latestMessage = exchange[exchange.length - 1];
        if (latestMessage instanceof OrderStatus) {
            hifiOfframpTransactionStatus = hifiOfframpTransactionStatusMap[latestMessage.data.status];
        }
    }

    if (!hifiOfframpTransactionStatus || hifiOfframpTransactionStatus === transaction.transaction_status)
        return;

    const { data: updateData, error: updateError } = await supabase
        .from('offramp_transactions')
        .update({
            transaction_status: hifiOfframpTransactionStatus,
            updated_at: new Date().toISOString(),
            failed_reason: hifiOfframpTransactionStatus === "FAILED_FIAT_RETURNED" ? undefined : closedReason,
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
		.or("transaction_status.eq.COMPLETED_ONCHAIN, transaction_status.eq.IN_PROGRESS_FIAT")
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