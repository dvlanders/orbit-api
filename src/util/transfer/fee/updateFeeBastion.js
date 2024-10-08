const { BASTION_URL, BASTION_API_KEY } = process.env;
const createLog = require("../../../util/logger/supabaseLogger");
const { safeParseBody } = require("../../utils/response");
const { updateFeeRecord } = require("./updateFeeRecord");

const statusMapBastion = {
	ACCEPTED: "SUBMITTED",
	SUBMITTED: "SUBMITTED",
	CONFIRMED: "CONFIRMED",
	FAILED: "FAILED",
	PENDING: "PENDING"
}

const updateDeveloperFeeRecordBastion = async(feeRecord, responseBody=null, response=null) => {
    let data = responseBody
    if (!data) {
        const url = `${BASTION_URL}/v1/user-actions/${feeRecord.request_id}?userId=${feeRecord.charged_user_id}`;
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${BASTION_API_KEY}`
            }
        };

        response = await fetch(url, options);
        data = await safeParseBody(response)
        if (response.status === 404 || !response.ok) {
            const errorMessage = `Failed to get user-action from bastion. Status: ${response.status}. Message: ${data.message || 'Unknown error'}. Bastion request Id: ${feeRecord.request_id}`;
            await createLog('pollDeveloperFeeStatus/updateStatus', feeRecord.charged_user_id, errorMessage, data);
            return
        }
    }
    // update the record
    const toUpdate = {
        charged_status: statusMapBastion[data.status] || "UNKNOWN",
        bastion_status: data.status,
        bastion_response: data,
        updated_at: new Date().toISOString()
    }
    await updateFeeRecord(feeRecord.id, toUpdate)
}

module.exports = { updateDeveloperFeeRecordBastion }
