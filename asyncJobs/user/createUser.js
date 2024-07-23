const createAndFundBastionUser = require("../../src/util/bastion/main/createAndFundBastionUser");
const { createBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/submitBusinessBridgeCustomerApplication");
const { createIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/submitIndividualBridgeCustomerApplication");
const { createCheckbookUser } = require("../../src/util/checkbook/endpoint/createCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");


const createUserAsyncCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    return false
}

const createUserAsync = async(config) => {
    try{
        let bridgeFunction
        if (config.userType == "business"){
            bridgeFunction = createBusinessBridgeCustomer
        }else if(config.userType == "individual"){
            bridgeFunction = createIndividualBridgeCustomer
        }else {
			throw new Error(`userType is not found: ${config.userType}`)	
		}
        // Create customer objects for providers
        const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
            createAndFundBastionUser(config.userId),
            bridgeFunction(config.userId),
            createCheckbookUser(config.userId)
        ]);

    }catch (error){
        await createLog("createUserAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    createUserAsync,
    createUserAsyncCheck
}