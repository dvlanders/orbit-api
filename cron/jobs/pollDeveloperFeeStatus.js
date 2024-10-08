const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { safeParseBody } = require("../../src/util/utils/response");
const { BASTION_URL, BASTION_API_KEY, CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

const statusMapCircle = {
	"INITIATED": "SUBMITTED",
	"QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
	"CANCELED": "CANCELED",
	"FAILED": "FAILED",
	"DENIED": "FAILED",
	"ACCELERATED": "PENDING"
}

const statusMapBastion = {
	ACCEPTED: "SUBMITTED",
	SUBMITTED: "SUBMITTED",
	CONFIRMED: "CONFIRMED",
	FAILED: "FAILED",
	PENDING: "PENDING"
}

const updateDeveloperFeeRecord = async (feeTransactionId, toUpdate) => {
    const { data: updateData, error: updateError } = await supabaseCall(() => supabase
        .from('developer_fees')
        .update(toUpdate)
        .eq('id', feeTransactionId)
        .select()
        .single())
	if (updateError) throw updateError
	return updateData
}


const updateStatusBastion = async (transaction) => {

	const url = `${BASTION_URL}/v1/user-actions/${transaction.request_id}?userId=${transaction.charged_user_id}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (response.status === 404 || !response.ok) {
			const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${transaction.request_id}`;
			await createLog('pollDeveloperFeeStatus/updateStatus', transaction.charged_user_id, errorMessage, data);
			return
		}

		// update the record
		const toUpdate = {
			charged_status: statusMapBastion[data.status] || "UNKNOWN",
			bastion_status: data.status,
			bastion_response: data,
			updated_at: new Date().toISOString()
		}
		await updateDeveloperFeeRecord(transaction.id, toUpdate)
	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollDeveloperFeeStatus/updateStatusBastion', transaction.charged_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateCircleStatus = async (feeTransaction) => {
	const circleTransactionId = feeTransaction.circle_transaction.circle_transaction_id
	const url = `${CIRCLE_WALLET_URL}/v1/w3s/transactions/${circleTransactionId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${CIRCLE_WALLET_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await safeParseBody(response)
        let toUpdate, toUpdateCircleTransaction
		if (!response.ok) {
			await createLog('pollDeveloperFeeStatus/updateCircleStatus', feeTransaction.charged_user_id, data.message, data);
            toUpdate = {
				charged_status: "FAILED",
                updated_at: new Date().toISOString(),
				failed_reason: "Please contact HIFI support for more information"
            }
			toUpdateCircleTransaction = {
				circle_status: "FAILED",
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
		}else{
			const transaction = data.data.transaction
            toUpdate = {
                charged_status: statusMapCircle[transaction.state] || "UNKNOWN",
                transaction_hash: transaction.txHash,
                updated_at: new Date().toISOString()
            }
			toUpdateCircleTransaction = {
				circle_status: transaction.state,
				updated_at: new Date().toISOString(),
				circle_response: data,
			}
        }
		await Promise.all([
			updateDeveloperFeeRecord(feeTransaction.id, toUpdate),
			updateCircleTransactionRecord(feeTransaction.circle_transaction_record_id, toUpdateCircleTransaction)
		])


	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollDeveloperFeeStatus/updateCircleStatus', feeTransaction.charged_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateStatusFuncMap = {
    BASTION: updateStatusBastion,
    CIRCLE: updateCircleStatus
}

async function pollDeveloperFeeStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: developerFeeData, error: developerFeeDataError } = await supabaseCall(() => supabase
			.from('developer_fees')
            .update({updated_at: new Date().toISOString()})
            .or("charged_status.eq.SUBMITTED, charged_status.eq.PENDING")
            .not("request_id", "is", null)
			.order('updated_at', { ascending: true })
			.select("*, circle_transaction: circle_transaction_record_id(*)")
		)

        
		if (developerFeeDataError) {
            console.error('Failed to fetch transactions for developer fee', developerFeeDataError);
			await createLog('pollDeveloperFeeStatus', null, 'Failed to fetch transactions', developerFeeDataError);
			return;
		}

		// For each transaction, get the latest status from the Bastion API and update the db
		await Promise.all(developerFeeData.map(async (transaction) => 
            {
                const updateStatusFunc = updateStatusFuncMap[transaction.crypto_provider]
                if (!updateStatusFunc) {
                    await createLog("pollDeveloperFeeStatus", transaction.charged_user_id, `No update function found for ${transaction.crypto_provider}`)
                    return
                }
                await updateStatusFunc(transaction)
            }
    )
    )
	} catch (error) {
		await createLog("pollDeveloperFeeStatus", null, "Failed to poll developer fee status", error.message)
	}
}

module.exports = pollDeveloperFeeStatus;