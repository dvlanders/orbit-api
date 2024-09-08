const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")
const { executeSandboxAsyncTransferCryptoToFiat } = require("../../../src/util/transfer/cryptoToBankAccount/transfer/sandboxCryptoToFiatTransfer")
const { executeAsyncBastionSandboxCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/bastionTransfeSandboxUSDHIFI")
const { JobError, JobErrorType } = require("../../error")

exports.cryptoToCryptoTransferSandboxAsync = async (config) => {
	try {

		await executeAsyncBastionSandboxCryptoTransfer(config)

    }catch (error){
        if (error instanceof JobError) throw error
        await createLog("job/transfer/cryptoToCryptoTransferSandboxAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
    }

}

