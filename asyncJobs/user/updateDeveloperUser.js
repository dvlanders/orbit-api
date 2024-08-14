const updateBastionDeveloperUser = require("../../src/util/bastion/main/updateBastionDeveloperUser");
const updateBastionUser = require("../../src/util/bastion/main/updateBastionUser");
const { getBastionWallet } = require("../../src/util/bastion/utils/getBastionWallet");
const { updateBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/updateBusinessBridgeCustomer");
const { updateIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/updateIndividualBridgeCustomer");
const { updateCheckbookUser } = require("../../src/util/checkbook/endpoint/updateCheckbookUser");
const { Chain } = require("../../src/util/common/blockchain");
const createLog = require("../../src/util/logger/supabaseLogger");
const { isFeeWalletRegistered } = require("../../src/util/smartContract/registerWallet/checkFeeWalletIsRegistered");
const { regsiterFeeWallet } = require("../../src/util/smartContract/registerWallet/registerFeeWallet");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");

const chainToRegister = [
    Chain.POLYGON_MAINNET
]

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
        const userId = config.userId
		// update customer object for providers
		const [bastionResult, bridgeResult, checkbookResult] = await Promise.all([
			updateBastionDeveloperUser(userId), 
			bridgeFunction(userId), 
			updateCheckbookUser(userId) 
		])

        // register fee wallet on payment processor contract
        await Promise.all(chainToRegister.map(async(chain) => {
            const {walletAddress} = await getBastionWallet(userId, chain, "FEE_COLLECTION")
            if (await isFeeWalletRegistered(chain, walletAddress)) return

            // register the fee wallet
            await regsiterFeeWallet(userId, walletAddress, chain)
        }))


    }catch (error){
        await createLog("updateDeveloperUserAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    updateDeveloperUserAsync,
    updateDeveloperUserAsyncCheck
}