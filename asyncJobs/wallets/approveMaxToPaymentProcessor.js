
const { Chain } = require("../../src/util/common/blockchain")
const createLog = require("../../src/util/logger/supabaseLogger")
const { MAX_APPROVE_TOKEN, approveMaxTokenToPaymentProcessor } = require("../../src/util/smartContract/approve/approveToken")
const { JobError, JobErrorType } = require("../error")

const approveMaxTokenToPaymentProcessorAsync = async(config) => {
    try{
        await approveMaxTokenToPaymentProcessor(config.userId, config.chain, config.currency)
    }catch (error){
        await createLog("asyncJob/fundGas", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, undefined, undefined, true)
    }
}

module.exports = {
    approveMaxTokenToPaymentProcessorAsync
}