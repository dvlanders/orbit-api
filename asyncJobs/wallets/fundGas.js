const fundUserGasFee = require("../../src/util/bastion/fundGasFee")
const { Chain } = require("../../src/util/common/blockchain")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { JobError, JobErrorType } = require("../error")
const areObjectsEqual = require("../utils/configCompare")

const fundGasScheduleCheck = async(job, config, userId, profileId) => {
    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    for (const record of data){
        if (areObjectsEqual(record.config, config)) return false
    }

    return true
}

const fundGas = async(config) => {
    try{
        const chain = config.chain
        const result = await fundUserGasFee(config.userId, config.amount, chain, config.walletType || "INDIVIDUAL")
        if (!result) throw new Error("Failed to fund GAS")
    }catch (error){
        await createLog("asyncJob/fundGas", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, undefined, undefined, true)
    }
}

module.exports = {
    fundGas,
    fundGasScheduleCheck
}