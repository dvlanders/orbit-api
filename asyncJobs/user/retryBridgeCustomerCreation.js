const { createBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/submitBusinessBridgeCustomerApplication");
const { createIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/submitIndividualBridgeCustomerApplication");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const notifyUserStatusUpdate = require("../../webhooks/user/notifyUserStatusUpdate");
const { JobError, JobErrorType } = require("../error");


const retryBridgeCustomerCreationCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    return false
}

const retryBridgeCustomerCreation = async(config) => {
    const userId = config.userId
    const bridgeId = config.bridgeId
    const isUpdate = bridgeId ? true : false
    try{
        let bridgeFunction
        if (config.userType == "business"){
            bridgeFunction = createBusinessBridgeCustomer
        }else if(config.userType == "individual"){
            bridgeFunction = createIndividualBridgeCustomer
        }else {
			throw new Error(`userType is not found: ${config.userType}`)	
		}

        // resubmit bridge kyc application
        await bridgeFunction(userId, bridgeId, isUpdate)
		if (process.env.NODE_ENV === "development") await notifyUserStatusUpdate(userId)

    }catch (error){
        await createLog("retryBridgeCustomerCreation", userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    retryBridgeCustomerCreation,
    retryBridgeCustomerCreationCheck
}