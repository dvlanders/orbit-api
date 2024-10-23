const { BASTION_URL, BASTION_API_KEY } = process.env;
const createLog = require("../../../util/logger/supabaseLogger");
const { updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../bastion/main/bastionTransactionTableService");
const { safeParseBody } = require("../../utils/response");
const { updateFeeRecord } = require("./updateFeeRecord");
const { fetchWithLogging } = require("../../logger/fetchLogger");

const statusMapBastion = {
	ACCEPTED: "SUBMITTED",
	SUBMITTED: "SUBMITTED",
	CONFIRMED: "CONFIRMED",
	FAILED: "FAILED",
	PENDING: "PENDING"
}

const updateDeveloperFeeRecordBastion = async(feeTransaction, responseBody=null, response=null) => {
    let data = responseBody
    if (!data) {
        // get the requestId from the bastion transaction
        const bastionTransaction = await getBastionTransactionRecord(feeTransaction.bastion_transaction_record_id)
        const requestId = bastionTransaction.request_id
        const bastionUserId = bastionTransaction.bastion_user_id
        const url = `${BASTION_URL}/v1/user-actions/${requestId}?userId=${bastionUserId}`;
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${BASTION_API_KEY}`
            }
        };

        response = await fetchWithLogging(url, options, "BASTION");
        data = await safeParseBody(response)
        if (response.status === 404 || !response.ok) {
            const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${feeRecord.request_id}`;
            await createLog('pollDeveloperFeeStatus/updateStatus', feeRecord.charged_user_id, errorMessage, data);
            return
        }
    }

    let toUpdate, toUpdateBastionTransaction
    if (!response.ok) {
        await createLog('pollDeveloperFeeStatus/updateDeveloperFeeRecordBastion', feeTransaction.charged_user_id, data.message, data);
        toUpdate = {
            charged_status: "FAILED",
            updated_at: new Date().toISOString(),
            failed_reason: "Please contact HIFI support for more information"
        }
        toUpdateBastionTransaction = {
            bastion_status: "FAILED",
            updated_at: new Date().toISOString(),
            bastion_response: data,
        }
    }else{
        toUpdate = {
            charged_status: statusMapBastion[data.status] || "UNKNOWN",
            transaction_hash: data.transactionHash,
            updated_at: new Date().toISOString()
        }
        toUpdateBastionTransaction = {
            bastion_status: data.status,
            updated_at: new Date().toISOString(),
            bastion_response: data,
        }
    }
    await Promise.all([
        updateFeeRecord(feeTransaction.id, toUpdate),
        updateBastionTransactionRecord(feeTransaction.bastion_transaction_record_id, toUpdateBastionTransaction)
    ])
}

module.exports = { updateDeveloperFeeRecordBastion }
