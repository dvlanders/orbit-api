const updateBastionDeveloperUser = require("../../src/util/bastion/main/updateBastionDeveloperUser");
const updateBastionUser = require("../../src/util/bastion/main/updateBastionUser");
const { updateBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/updateBusinessBridgeCustomer");
const { updateIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/updateIndividualBridgeCustomer");
const { updateCheckbookUser } = require("../../src/util/checkbook/endpoint/updateCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");


const updateDeveloperUserAsyncCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    return false
}

const updateDeveloperUserAsync = async(config) => {
    try{
        let bridgeFunction
		if (config.userType === "individual") {
			bridgeFunction = updateIndividualBridgeCustomer;
		} else if (config.userType === "business") {
			bridgeFunction = updateBusinessBridgeCustomer;
		} else {
			throw new Error(`userType is not found: ${config.userType}`)	
		}

		// update customer object for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			updateBastionDeveloperUser(config.userId), 
			bridgeFunction(config.userId), 
			updateCheckbookUser(config.userId) 
		])


    }catch (error){
        await createLog("updateDeveloperUserAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    updateDeveloperUserAsync,
    updateDeveloperUserAsyncCheck
}