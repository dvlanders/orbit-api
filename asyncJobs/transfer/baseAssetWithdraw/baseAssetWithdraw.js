const createLog = require("../../../src/util/logger/supabaseLogger")
const { executeAsyncBastionBaseAssetTransfer } = require("../../../src/util/transfer/baseAsset/withdrawGasToWallet")
const { JobError, JobErrorType } = require("../../error")

const baseAssetWithdrawAsync = async(config) => {

    try{
        await executeAsyncBastionBaseAssetTransfer(config)

    }catch (error){
        if (error instanceof JobError) throw error
        await createLog("job/transfer/baseAssetWithdrawAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
    }

}


module.exports = {
    baseAssetWithdrawAsync
}