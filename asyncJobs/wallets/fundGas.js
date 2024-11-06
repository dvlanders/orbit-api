const { Chain } = require("../../src/util/common/blockchain")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const fundUserGasFee = require("../../src/util/transfer/gas/main/fundGasFee")
const { JobError, JobErrorType } = require("../error")
const areObjectsEqual = require("../utils/configCompare")

const fundGas = async(config) => {
    
    try{
        const chain = config.chain
        const {shouldReschedule, success} = await fundUserGasFee(config.userId, config.amount, chain, config.walletType || "INDIVIDUAL", config.profileId)
        if (!success) throw new Error("Failed to fund GAS")
    }catch (error){
        await createLog("asyncJob/fundGas", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, undefined, undefined, false)
    }
}

module.exports = {
    fundGas,
}