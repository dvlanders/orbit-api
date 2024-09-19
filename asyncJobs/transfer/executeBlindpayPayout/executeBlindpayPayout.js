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
const { syncTransactionFeeRecordStatus, chargeTransactionFee } = require("../../../src/util/billing/fee/transactionFeeBilling")
const { transferType } = require("../../../src/util/transfer/utils/transfer")

exports.executeBlindpayPayout = async (config) => {
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
			const toUpdate = {
				blindpay_payout_response: error.rawResponse,
				transaction_status: "QUOTE_FAILED"
			}
			// send out webhook message if in sandbox
			if (process.env.NODE_ENV == "development") {
				toUpdate.transaction_status = "COMPLETED"
				toUpdate.failed_reason = "This is a simulated success response for sandbox environment only."
			}
			await updateRequestRecord(config.recordId, toUpdate);

			if(process.env.NODE_ENV == "development") {
				await chargeTransactionFee(record.id, transferType.CRYPTO_TO_FIAT);
				await simulateSandboxCryptoToFiatTransactionStatus(record)
			}
			await syncTransactionFeeRecordStatus(record.id, transferType.CRYPTO_TO_FIAT);
			await notifyCryptoToFiatTransfer(record);
		}
      throw new Error("Blindpay payout execution failed");
    }

	const toUpdate = {
		blindpay_payout_id: blindpayExecutePayoutBody.id,
		blindpay_payout_response: blindpayExecutePayoutBody,
      	blindpay_payout_status: blindpayExecutePayoutBody.status,
      	transaction_status: blindpayPayoutStatusMap[blindpayExecutePayoutBody.status] || "UNKNOWN"
	}
    await updateRequestRecord(config.recordId, toUpdate);
	await syncTransactionFeeRecordStatus(config.recordId, transferType.CRYPTO_TO_FIAT);
	await notifyCryptoToFiatTransfer(record);

	} catch (error) {
		console.error(error)
		if (error instanceof JobError) throw error
		await createLog("job/transfer/executeBlindpayPayout", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
	}

}
