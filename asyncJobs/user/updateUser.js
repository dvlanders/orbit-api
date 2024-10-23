const updateBastionUser = require("../../src/util/bastion/main/updateBastionUser");
const { updateBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/updateBusinessBridgeCustomer");
const { updateIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/updateIndividualBridgeCustomer");
const { updateCheckbookUser } = require("../../src/util/checkbook/endpoint/updateCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { updateUserWallet } = require("../../src/util/user/updateUserWallet");
const notifyUserStatusUpdate = require("../../webhooks/user/notifyUserStatusUpdate");
const { JobError, JobErrorType } = require("../error");

const updateUserAsync = async(config) => {
    try{
        let bridgeFunction
		if (config.userType === "individual") {
			bridgeFunction = updateIndividualBridgeCustomer;
		} else if (config.userType === "business") {
			bridgeFunction = updateBusinessBridgeCustomer;
		} else {
			throw new Error(`userType is not found: ${config.userType}`)	
		}

		// NOTE: in the future we may want to determine which 3rd party calls to make based on the fields that were updated, but lets save that for later
		// update customer object for providers
		const [walletResult, bridgeResult, checkbookResult] = await Promise.all([
			updateUserWallet(config.userId),
			bridgeFunction(config.userId),
			updateCheckbookUser(config.userId)
		])

        if (process.env.NODE_ENV === "development") await notifyUserStatusUpdate(config.userId)


    }catch (error){
        await createLog("updateUserAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    updateUserAsync,
}