
const { Chain } = require("../../src/util/common/blockchain")
const createLog = require("../../src/util/logger/supabaseLogger")
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
    
    if (!data || data.length <= 0) return true
    for (const record of data){
        if (areObjectsEqual(record.config, config)) return false
    }

    return true
}

const approveMaxTokenToPaymentProcessorAsync = async(config) => {
    try{
        if (config.chain == Chain.POLYGON_MAINNET || config.chain == Chain.POLYGON_AMOY){
            const result = await fundMaticPolygon(config.userId, config.amount)
            if (!result) throw new Error("Failed to fund Matic")
        }else {
            throw new Error("Chain not found")
        }
    }catch (error){
        createLog("asyncJob/fundGas", config.userId, error.message)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, undefined, undefined, true)
    }
}

module.exports = {
    fundGas,
    fundGasScheduleCheck
}