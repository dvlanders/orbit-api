const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")
const { BastionTransferStatus } = require("../../../src/util/bastion/utils/utils")
const { blindpayPayoutStatusMap } = require("../../../src/util/blindpay/endpoint/utils")
const { JobError, JobErrorType } = require("../../error")
const { updateRequestRecord } = require("../../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord")
const { executePayout } = require("../../../src/util/blindpay/endpoint/executePayout")
const { ExecutePayoutError } = require("../../../src/util/blindpay/errors")

exports.executeBlindpayPayout = async (config) => {
	console.log("executeBlindpayPayout", config)
	try {
		const { data: record, error } = await supabase
			.from("offramp_transactions")
			.select("*")
			.eq("id", config.recordId)
			.single()

		if (error) throw error

    let blindpayExecutePayoutBody;
    try {
      blindpayExecutePayoutBody = await executePayout(record.blindpay_quote_id,record.from_wallet_address);
    } catch (error) {
		if (error instanceof ExecutePayoutError) {
			await updateRequestRecord(config.recordId, { blindpay_payout_response: error.rawResponse, transaction_status: "FAILED_ONCHAIN" });
		}
      throw new Error("Blindpay payout execution failed");
    }

	const toUpdate = {
		blindpay_payout_response: blindpayExecutePayoutBody,
      	blindpay_payout_status: blindpayExecutePayoutBody.status,
      	transaction_status: blindpayPayoutStatusMap[blindpayExecutePayoutBody.status] || "UNKNOWN"
	}
    await updateRequestRecord(config.recordId, toUpdate);

	} catch (error) {
		console.error(error)
		if (error instanceof JobError) throw error
		await createLog("job/transfer/executeBlindpayPayout", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
	}

}
