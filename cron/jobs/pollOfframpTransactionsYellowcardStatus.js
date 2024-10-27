const supabase = require('../../src/util/supabaseClient');
const createLog = require('../../src/util/logger/supabaseLogger');
const notifyCryptoToFiatTransfer = require('../../webhooks/transfer/notifyCryptoToFiatTransfer');
const { getBearerDid } = require('../../src/util/yellowcard/utils/getBearerDid');
const { hifiOfframpTransactionStatusMap, failedReasonMap } = require('../../src/util/yellowcard/utils/utils');
const notifyTransaction = require('../../src/util/logger/transactionNotifier');
const { rampTypes } = require('../../src/util/transfer/utils/ramptType');
const { updateOfframpTransactionRecord } = require('../../src/util/transfer/cryptoToBankAccount/utils/offrampTransactionsTableService');
const { updateYellowCardTransactionInfo } = require('../../src/util/yellowcard/transactionInfoService');

const updateStatusWithYellowcardTransferId = async (transaction) => {
    try{
        const { data: yellowcardTransactionRecord, error: yellowcardTransactionError } = await supabase
            .from('yellowcard_transactions')
            .select('*')
            .eq('id', transaction.yellowcard_transaction_record_id)
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
            exchangeId: yellowcardTransactionRecord.exchange_id
        });
        const close = exchange.find(message => message.kind === 'close');

        // update status based on latest message
        const toUpdateOfframpRecord = {
            updated_at: new Date().toISOString(),
        }
        const toUpdateYellowcardTransactionRecord = {
            updated_at: new Date().toISOString(),
        }


        const latestMessage = exchange[exchange.length - 1];
        console.log("latestMessage", latestMessage)
        let flaggedForSlack = false;
        
        if (latestMessage instanceof OrderStatus) {
            // this will trigger if the last message is an OrderStatus message
            // update record via OrderStatus
            toUpdateOfframpRecord.transaction_status = hifiOfframpTransactionStatusMap[latestMessage.data.status];
            toUpdateYellowcardTransactionRecord.yellowcard_status = latestMessage.data.status;
            toUpdateYellowcardTransactionRecord.last_exchange_message = latestMessage.toJSON()
            // set failed reason if any
            if (Object.keys(failedReasonMap).includes(latestMessage.data.status)) {
                toUpdateOfframpRecord.failed_reason = failedReasonMap[latestMessage.data.status];
                flaggedForSlack = true;
            }
        }else if (close) {
            // this will trigger if the last message is a Close message and it's successful
            //update record via successful close
            toUpdateYellowcardTransactionRecord.order_close_message = close.toJSON()
            // get the order status before close, in case we missed that message
            const orderStatusBeforeClose = exchange[exchange.length - 2];
            if (!orderStatusBeforeClose || !(orderStatusBeforeClose instanceof OrderStatus)) {
                // Unknown status if no order status before close
                toUpdateOfframpRecord.transaction_status = "UNKNOWN"
                toUpdateYellowcardTransactionRecord.yellowcard_status = "UNKNOWN"
                flaggedForSlack = true;
            }else{
                // set status based on order status before close
                toUpdateOfframpRecord.transaction_status = hifiOfframpTransactionStatusMap[orderStatusBeforeClose.data.status];
                toUpdateYellowcardTransactionRecord.yellowcard_status = orderStatusBeforeClose.data.status;
                toUpdateYellowcardTransactionRecord.last_exchange_message = orderStatusBeforeClose.toJSON();
                // set failed reason if any
                if (Object.keys(failedReasonMap).includes(orderStatusBeforeClose.data.status)) {
                    toUpdateOfframpRecord.failed_reason = failedReasonMap[orderStatusBeforeClose.data.status];
                    flaggedForSlack = true;
                }
            }
        }

        // if received a close message that is not successful, we need to update the offramp record as failed
        if (close && !close.data.success) {
            await createLog('pollOfframpTransactionsYellowcardStatus/updateStatusWithYellowcardTransferId', transaction.user_id, 'Received a close message that is not successful', close);
            flaggedForSlack = true;
        }

        // send slack notification if flagged
        if (flaggedForSlack) {
            notifyTransaction(
                transaction.user_id,
                rampTypes.OFFRAMP,
                transaction.id,
                {
                    prevTransactionStatus: transaction.transaction_status,
                    updatedTransactionStatus: toUpdateOfframpRecord.transaction_status,
                    yellowcardStatus: toUpdateYellowcardTransactionRecord.yellowcard_status,
                    failedReason: toUpdateOfframpRecord.failed_reason,
                }
            );
        }

        // update the offramp transaction record
        const [updatedOfframpTransaction, updatedYellowcardTransaction] = await Promise.all([
            updateOfframpTransactionRecord(transaction.id, toUpdateOfframpRecord),
            updateYellowCardTransactionInfo(transaction.yellowcard_transaction_record_id, toUpdateYellowcardTransactionRecord),
        ])

        if (transaction.transaction_status == toUpdateOfframpRecord.transaction_status) return
        // send webhook message
        await notifyCryptoToFiatTransfer(updatedOfframpTransaction);
    }catch(error){
        await createLog('pollOfframpTransactionsYellowcardStatus/updateStatusWithYellowcardTransferId', transaction.user_id, error.message, error);
    }
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