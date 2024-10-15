const { createUserAsyncCheck } = require("../../../asyncJobs/user/createUser")
const getBridgeCustomer = require("../bridge/endpoint/getBridgeCustomer")
const getCheckbookUser = require("../checkbook/endpoint/getCheckbookUser")
const createLog = require("../logger/supabaseLogger")
const { CustomerStatus } = require("./common")
const { getUserWalletStatus } = require("./getUserWalletStatus")
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { defaultKycInfo, updateKycInfo } = require("./kycInfo");
const { getUserRecord } = require("./userService");

exports.getRawUserObject = async(userId, profileId) => {
    try{

		const user = await getUserRecord(userId);
		if (!user) return {status: 404, getHifiUserResponse: { error: "User not found for provided userId" }};
		// check is developer user
		if (user.is_developer) return {status: 400, getHifiUserResponse: { error: "This is a developer user account, please use GET user/developer" }};

        // base response
		const getHifiUserResponse = defaultKycInfo(userId, user.kyc_level);

		// check if the userCreation is in the job queue, if yes return pending response
		const canScheduled = await createUserAsyncCheck("createUser", {}, userId, profileId)
		if (!canScheduled) return {status: 200 , getHifiUserResponse}
        
        // get status
		const [walletResult, bridgeResult, checkbookResult] = await Promise.all([
			getUserWalletStatus(userId),
			getBridgeCustomer(userId, user.kyc_level),
			getCheckbookUser(userId)
		])

		updateKycInfo(getHifiUserResponse, walletResult, bridgeResult, checkbookResult);

        // determine the status code to return to the client -- copied from createHifiUser, make sure this logic still holds true
		let status
		if (checkbookResult.status === 200 && bridgeResult.status === 200 && walletResult.status === 200) {
			status = 200
		} else if (checkbookResult.status === 500 || bridgeResult.status === 500 || walletResult.status == 500) {
			status = 500;
		} else {
			status = 400;
		}

        return {status, getHifiUserResponse}


    }catch (error){
        await createLog("user/getRawUserObject", userId, error.message, error)
        throw new Error("Error happened in getRawUserObject")
    }

}