const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const createLog = require('../../src/util/logger/supabaseLogger');
const { updateFiatToFiatRecordById } = require("../../src/util/transfer/fiatToFiat/utils/fiatToFiatTransactionService");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const updateStatus = async (fiatTransaction) => {
	// get user api key
	let { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
		.from('checkbook_users')
		.select('api_key, api_secret')
		.eq("checkbook_user_id", fiatTransaction.source_checkbook_user_id)
		.maybeSingle());

    if (checkbookUserError) {
        return await createLog("pollFiatToFiatCheckbookStatus", fiatTransaction.source_user_id, checkbookUserError.message, checkbookUserError);
    }
    if (!checkbookUser){
        return await createLog("pollFiatToFiatCheckbookStatus", fiatTransaction.source_user_id, `No checkbook user found for fiat-to-fiat record:  ${fiatTransaction.id}`);
    }
    
    // pull up-to-date status
    const url = `${CHECKBOOK_URL}/check/${fiatTransaction.checkbook_payment_id}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `${checkbookUser.api_key}:${checkbookUser.api_secret}`, // use the api key of the checkbook user that received the payment
        },
    };

    const response = await fetch(url, options)
    const responseBody = await response.json()
    if (!response.ok) {
        return await createLog("pollFiatToFiatCheckbookStatus", fiatTransaction.source_user_id, responseBody.message, responseBody);
    }
    // map status
    let status;
    if (responseBody.status == "PAID"){
        status = "FIAT_PROCESSED"
    }else if (responseBody.status == "IN_PROCESS"){
        status = "FIAT_SUBMITTED"
    }else if (responseBody.status == "REFUNDED"){
        status = "REFUNDED"
    }else{
        status = "UNKNOWN"
        await createLog("pollFiatToFiatCheckbookStatus", fiatTransaction.source_user_id, `Unable to processed status: ${responseBody.status}`, responseBody)
    }

    const toUpdate = {
        status,
        checkbook_status: responseBody.status,
        checkbook_response: responseBody,
    }
    await updateFiatToFiatRecordById(fiatTransaction.id, toUpdate);

}

async function pollFiatToFiatCheckbookStatus() {

	const { data: fiatTransactionStatus, error: fiatTransactionStatusError } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.select('id, checkbook_payment_id, source_user_id, source_checkbook_user_id, status')
        .eq('fiat_provider', "CHECKBOOK")
        .not('checkbook_payment_id', 'is', null)
        .or('status.eq.FIAT_SUBMITTED, checkbook_status.eq.IN_PROCESS')
        .order('updated_at', {ascending: true}));

	if (fiatTransactionStatusError) {
		return await createLog('pollFiatToFiatCheckbookStatus', null, fiatTransactionStatusError.message, fiatTransactionStatusError);
	}
	await Promise.all(fiatTransactionStatus.map(async (fiatTransaction) => await updateStatus(fiatTransaction)));

}

module.exports = pollFiatToFiatCheckbookStatus
