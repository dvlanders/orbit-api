const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")
const { executeSandboxAsyncTransferCryptoToFiat } = require("../../../src/util/transfer/cryptoToBankAccount/transfer/sandboxCryptoToFiatTransfer")
const { JobError, JobErrorType } = require("../../error")

exports.cryptoToFiatTransferSandboxAsync = async (config) => {
	try {
		// fetch record
		const { data: record, error } = await supabase
			.from("offramp_transactions")
			.select("*")
			.eq("id", config.recordId)
			.single()

		if (error) throw error

		const transferConfig = { profileId: config.profileId, recordId: record.id }

		await executeSandboxAsyncTransferCryptoToFiat(transferConfig)

	} catch (error) {
		if (error instanceof JobError) throw error
		await createLog("job/transfer/cryptoToFiatTransferSandboxAsync", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
	}

}

