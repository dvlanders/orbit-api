const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")

const { JobError, JobErrorType } = require("../../error")

exports.executeBlindpayPayout = async (config) => {
	try {
		const { data: record, error } = await supabase
			.from("offramp_transactions")
			.select("*")
			.eq("id", config.recordId)
			.single()

		if (error) throw error


		// execute the payout with blindpay's api
		const headers = {
			'Accept': 'application/json',
			'Authorization': `Bearer ${process.env.BLINDPAY_API_KEY}`,
			'Content-Type': 'application/json'
		};

		const payoutBody = {
			"quote_id": record.blindpay_quote_response.id,
			"sender_wallet_address": record.from_wallet_address
		}

		const url = `${process.env.BLINDPAY_URL}/instances/${process.env.BLINDPAY_INSTANCE_ID}/payouts/evm`;
		const blindpayExecutePayoutResponse = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(payoutBody)
		});

		const blindpayExecutePayoutBody = await blindpayExecutePayoutResponse.json();


		if (blindpayExecutePayoutResponse.status !== 200 || blindpayExecutePayoutBody.success === false) {
			// if payout is successful, update the offramp transaction record
			const { data: updatedRecord, error: updateError } = await supabase
				.from("offramp_transactions")
				.update({
					blindpay_payout_response: blindpayExecutePayoutBody,
					transaction_status: "FAILED_ONCHAIN"
				})
				.eq("id", config.recordId)
				.single()

			throw new Error("Blindpay payout execution failed")
		}

		const { data: updatedRecord, error: updateError } = await supabase
			.from("offramp_transactions")
			.update({
				blindpay_payout_response: blindpayExecutePayoutBody,
				transaction_status: "IN_PROGRESS_FIAT"
			})
			.eq("id", config.recordId)
			.single()



	} catch (error) {
		console.error(error)
		if (error instanceof JobError) throw error
		await createLog("job/transfer/executeBlindpayPayout", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
	}

}

