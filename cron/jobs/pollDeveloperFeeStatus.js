const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { BASTION_URL, BASTION_API_KEY } = process.env;


const updateStatusBastion = async (transaction) => {
    const chargedStatusMap = {
        ACCEPTED: "SUBMITTED",
        SUBMITTED: "SUBMITTED",
        CONFIRMED: "CONFIRMED",
        FAILED: "FAILED",
        PENDING: "PENDING"
    }

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
		if (chargedStatusMap[data.status] == transaction.charged_status) return
		// If the hifiOfframpTransactionStatus is different from the current transaction_status or if the data.status is different than the transaction.bastion_transaction_status, update the transaction_status
		const { data: updateData, error: updateError } = await supabaseCall(() => supabase
			.from('developer_fees')
			.update({
                charged_status: chargedStatusMap[data.status] || "UNKNOWN",
				bastion_status: data.status,
				bastion_response: data,
				updated_at: new Date().toISOString()
			})
			.eq('id', transaction.id)
			.select()
			.single())

		if (updateError) {
			console.error('Failed to update transaction status', updateError);
			await createLog('pollDeveloperFeeStatus/updateStatusBastion', transaction.charged_user_id, 'Failed to update developer fee status', updateError);
			return
		}

	} catch (error) {
		console.error('Failed to fetch transaction status from Bastion API', error);
		await createLog('pollDeveloperFeeStatus/updateStatusBastion', transaction.charged_user_id, 'Failed to fetch transaction status from Bastion API', error);
	}
}

const updateStatusFuncMap = {
    BASTION: updateStatusBastion
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
			.select("*")
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
                await updateStatusFunc(transaction)
            }
    )
    )
	} catch (error) {
		await createLog("pollDeveloperFeeStatus", null, "Failed to poll developer fee status", error.message)
	}
}

module.exports = pollDeveloperFeeStatus;