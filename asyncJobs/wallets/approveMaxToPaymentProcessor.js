
const { Chain } = require("../../src/util/common/blockchain")
const createLog = require("../../src/util/logger/supabaseLogger")
const { MAX_APPROVE_TOKEN, approveMaxTokenToPaymentProcessor } = require("../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../src/util/supabaseClient")
const { JobError, JobErrorType } = require("../error")
const areObjectsEqual = require("../utils/configCompare")

const approveMaxTokenToPaymentProcessorAsyncCheck = async(job, config, userId, profileId) => {
    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)

    // check the approve amount 
    const allowance = await getTokenAllowance(config.chain, config.currency, config.owner, config.spender)
    if (allowance < (MAX_APPROVE_TOKEN / 2)) return true

    // check double schedule
    if (!data || data.length <= 0) return true
    for (const record of data){
        if (areObjectsEqual(record.config, config)) return false
    }

    return true
}

const approveMaxTokenToPaymentProcessorAsync = async(config) => {
    try{
        await approveMaxTokenToPaymentProcessor(config.userId, config.chain, config.currency)
    }catch (error){
        createLog("asyncJob/fundGas", config.userId, error.message)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, undefined, undefined, true)
    }
}

module.exports = {
    approveMaxTokenToPaymentProcessorAsyncCheck,
    approveMaxTokenToPaymentProcessorAsync
}