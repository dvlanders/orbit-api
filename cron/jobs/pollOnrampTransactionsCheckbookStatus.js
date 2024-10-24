const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported
const notifyFiatToCryptoTransfer = require("../../webhooks/transfer/notifyFiatToCryptoTransfer");
const notifyTransaction = require("../../src/util/logger/transactionNotifier");
const { getCheckbookPayment } = require("../../src/util/checkbook/endpoint/getCheckbookPayment");
const { updateOnrampTransactionRecord } = require("../../src/util/transfer/fiatToCrypto/utils/onrampTransactionTableService");
const { updateCheckbookTransactionRecord } = require("../../src/util/checkbook/checkbookTransactionTableService");
const { rampTypes } = require("../../src/util/transfer/utils/ramptType");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const updateStatus = async (onrampTransaction) => {
    const checkbookTransactionInfo = onrampTransaction.checkbook_transaction_info;
    const bridgeTransactionInfo = onrampTransaction.bridge_transaction_info;
    if(!checkbookTransactionInfo) return;
	// get user api key
	let { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
		.from('checkbook_users')
		.select('api_key, api_secret')
		.eq("checkbook_user_id", checkbookTransactionInfo.destination_checkbook_user_id)
		.maybeSingle())

    if (checkbookUserError) {
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, checkbookUserError.message, checkbookUserError)
        return
    }
    if (!checkbookUser){
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, `No checkbook user found for onRamp record:  ${onrampTransaction.id}`)
        return
    }

    const {response, responseBody} = await getCheckbookPayment(checkbookTransactionInfo.checkbook_payment_id, checkbookUser.api_key, checkbookUser.api_secret);
    if (!response.ok) {
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, responseBody.message, responseBody)
        return
    }
    // map status
    let status
    if (responseBody.status == "PAID"){
        status = "FIAT_PROCESSED"
    }else if (responseBody.status == "IN_PROCESS"){
        status = "FIAT_SUBMITTED"
    }else if (responseBody.status == "REFUNDED"){
        status = "REFUNDED"
    }else{
        status = "UNKNOWN"
        await createLog("pollOnrampTransactionsCheckbookStatus", onrampTransaction.user_id, `Unable to processed status: ${responseBody.status}`, responseBody)
    }

    const updatedRecord = await updateOnrampTransactionRecord(onrampTransaction.id, {status});

    const toUpdateCheckbook = {
        checkbook_status: responseBody.status,
        checkbook_response: responseBody,
    }
    const updatedCheckbook = await updateCheckbookTransactionRecord(checkbookTransactionInfo.id, toUpdateCheckbook);

    if (status != onrampTransaction.status){
        // send slack notification if failed
        if (status === "REFUNDED") {
            notifyTransaction(
                onrampTransaction.user_id,
                rampTypes.ONRAMP,
                onrampTransaction.id,
                {
                    prevTransactionStatus: onrampTransaction.status,
                    updatedTransactionStatus: updatedRecord.status,
                    checkbookStatus: updatedCheckbook.checkbook_status,
                    bridgeStatus: bridgeTransactionInfo.bridge_status,
                    failedReason: updatedRecord.failed_reason,
                }
            );
        }

        await notifyFiatToCryptoTransfer(updatedRecord)
    }

}

async function pollOnrampTransactionsCheckbookStatus() {

	// Get all records where the bridge_transaction_status is not 
	const { data: onRampTransactionStatus, error: onRampTransactionStatusError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('id, user_id, status, checkbook_transaction_record_id, bridge_transaction_record_id, checkbook_transaction_info:checkbook_transaction_record_id(*), bridge_transaction_info:bridge_transaction_record_id(*)')
        .eq('fiat_provider', "CHECKBOOK")
        .not('checkbook_transaction_info.checkbook_payment_id', 'is', null)
        .eq('status', 'FIAT_SUBMITTED')
        .order('updated_at', {ascending: true})
    )

	if (onRampTransactionStatusError) {
		console.error('Failed to fetch transactions for pollOnrampTransactionsCheckbookStatus', onRampTransactionStatusError);
		await createLog('pollOnrampTransactionsCheckbookStatus', null, onRampTransactionStatusError.message, onRampTransactionStatusError);
		return;
	}
	await Promise.all(onRampTransactionStatus.map(async (onrampTransaction) => {
        if (onrampTransaction.checkbook_transaction_record_id && onrampTransaction.bridge_transaction_record_id){
            await updateStatus(onrampTransaction);
        }
    }))

}

module.exports = pollOnrampTransactionsCheckbookStatus
