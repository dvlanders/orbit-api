const { updateCircleTransactionRecord, getCircleTransactionRecord } = require("../../circle/main/circleTransactionTableService");
const createLog = require("../../logger/supabaseLogger");
const { safeParseBody } = require("../../utils/response");
const { updateFeeRecord } = require("./updateFeeRecord");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const { CIRCLE_WALLET_URL, CIRCLE_WALLET_API_KEY } = process.env;

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


const updateDeveloperFeeRecordCircle = async (feeTransaction, responseBody=null, response=null) => {
    let data = responseBody
    if (!data) {
        // get the transactionId from the circle transaction
        const circleTransaction = await getCircleTransactionRecord(feeTransaction.circle_transaction_record_id)
        const circleTransactionId = circleTransaction.circle_transaction_id
        const url = `${CIRCLE_WALLET_URL}/v1/w3s/transactions/${circleTransactionId}`;
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${CIRCLE_WALLET_API_KEY}`
            }
        };

        response = await fetchWithLogging(url, options);
        data = await safeParseBody(response)
    }

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
        updateFeeRecord(feeTransaction.id, toUpdate),
        updateCircleTransactionRecord(feeTransaction.circle_transaction_record_id, toUpdateCircleTransaction)
    ])


}

module.exports = { updateDeveloperFeeRecordCircle }
