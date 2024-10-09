const { BastionTransferStatus } = require("../../src/util/bastion/utils/utils");
const { updateCircleTransactionRecord } = require("../../src/util/circle/main/circleTransactionTableService");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const { updateDeveloperFeeRecordBastion } = require("../../src/util/transfer/fee/updateFeeBastion");
const { updateDeveloperFeeRecordCircle } = require("../../src/util/transfer/fee/updateFeeCircle");

const updateStatusFuncMap = {
    BASTION: updateDeveloperFeeRecordBastion,
    CIRCLE: updateDeveloperFeeRecordCircle
}

async function pollDeveloperFeeStatus() {
	try {
		// Get all records where the bastion_transaction_status is not BastionTransferStatus.CONFIRMED or BastionTransferStatus.FAILED
		const { data: developerFeeData, error: developerFeeDataError } = await supabaseCall(() => supabase
			.from('developer_fees')
            .update({updated_at: new Date().toISOString()})
            .or("charged_status.eq.SUBMITTED, charged_status.eq.PENDING")
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