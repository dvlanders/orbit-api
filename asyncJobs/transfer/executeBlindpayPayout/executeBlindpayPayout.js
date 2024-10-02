const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")
const { BastionTransferStatus } = require("../../../src/util/bastion/utils/utils")
const { blindpayPayoutStatusMap } = require("../../../src/util/blindpay/endpoint/utils")
const { JobError, JobErrorType } = require("../../error")
const { updateRequestRecord } = require("../../../src/util/transfer/cryptoToBankAccount/utils/updateRequestRecord")
const { executePayout } = require("../../../src/util/blindpay/endpoint/executePayout")
const { ExecutePayoutError } = require("../../../src/util/blindpay/errors")
const notifyCryptoToFiatTransfer = require("../../../webhooks/transfer/notifyCryptoToFiatTransfer")
const { simulateSandboxCryptoToFiatTransactionStatus } = require("../../../src/util/transfer/cryptoToBankAccount/utils/simulateSandboxCryptoToFiatTransaction")
const { updateBlinpdayTransactionInfo } = require("../../../src/util/blindpay/transactionInfoService")

exports.executeBlindpayPayout = async (config) => {
	try {
		const { data: record, error } = await supabase
			.from("offramp_transactions")
			.select("*, blindpay_transaction_info:blindpay_transaction_id (*)")
			.eq("id", config.recordId)
			.single()

		if (error) throw error

		const blindpayTransactionInfo = record.blindpay_transaction_info;

		let blindpayExecutePayoutBody;
		try {
			blindpayExecutePayoutBody = await executePayout(blindpayTransactionInfo.quote_id,record.from_wallet_address);
		} catch (error) {
			if (error instanceof ExecutePayoutError) {
				await updateBlinpdayTransactionInfo(record.blindpay_transaction_id, {payout_response: error.rawResponse});
				const toUpdate = {
					transaction_status: "QUOTE_FAILED"
				}
				// send out webhook message if in sandbox
				if (process.env.NODE_ENV == "development") {
					toUpdate.transaction_status = "COMPLETED"
					toUpdate.failed_reason = "This is a simulated success response for sandbox environment only."
				}
				await updateRequestRecord(config.recordId, toUpdate);

				if(process.env.NODE_ENV == "development") {
					await simulateSandboxCryptoToFiatTransactionStatus(record)
				}
				await notifyCryptoToFiatTransfer(record);
			}
			throw new Error("Blindpay payout execution failed");
		}

		const toUpdateBlindpay = {
			payout_id: blindpayExecutePayoutBody.id,
			payout_response: blindpayExecutePayoutBody,
			payout_status: blindpayExecutePayoutBody.status,
		}

		await updateBlinpdayTransactionInfo(record.blindpay_transaction_id, toUpdateBlindpay);
		await updateRequestRecord(config.recordId, {transaction_status: blindpayPayoutStatusMap[blindpayExecutePayoutBody.status] || "UNKNOWN"});
		await notifyCryptoToFiatTransfer(record);

	} catch (error) {
		console.error(error)
		if (error instanceof JobError) throw error
		await createLog("job/transfer/executeBlindpayPayout", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
	}

}
