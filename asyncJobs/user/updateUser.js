const updateBastionUser = require("../../src/util/bastion/main/updateBastionUser");
const { updateBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/updateBusinessBridgeCustomer");
const { updateIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/updateIndividualBridgeCustomer");
const { updateCheckbookUser } = require("../../src/util/checkbook/endpoint/updateCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");


const updateUserAsyncCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    return false
}

const updateUserAsync = async(config) => {
    try{
        let bridgeFunction
		if (config.userType === "individual") {
			bridgeFunction = updateIndividualBridgeCustomer;
		} else if (config.userType === "business") {
			bridgeFunction = updateBusinessBridgeCustomer;
		} else {
			return res.status(500).json({ error: "User type not found for provided userId" })	
		}

		// NOTE: in the future we may want to determine which 3rd party calls to make based on the fields that were updated, but lets save that for later
		// update customer object for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			updateBastionUser(config.userId), // TODO: implement this function in utils and import before using it here
			bridgeFunction(config.userId), // TODO: implement this function in utils and import before using it here
			updateCheckbookUser(config.userId) // TODO: implement this function in utils and import before using it here
		])

    }catch (error){
        await createLog("updateUserAsync", config.userId, error.message)
        throw new JobError(JobErrorType.INTERNAL_ERROR, "updateUserAsync job failed due to some unexpected reason", "", "", true)
    }
}

module.exports = {
    updateUserAsync,
    updateUserAsyncCheck
}