const createAndFundBastionUser = require("../../src/util/bastion/main/createAndFundBastionUser");
const {createBastionDeveloperUser} = require("../../src/util/bastion/main/createBastionUserForDeveloperUser");
const { getBastionWallet } = require("../../src/util/bastion/utils/getBastionWallet");
const { createBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/submitBusinessBridgeCustomerApplication");
const { createIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/submitIndividualBridgeCustomerApplication");
const { createCheckbookUser } = require("../../src/util/checkbook/endpoint/createCheckbookUser");
const { Chain } = require("../../src/util/common/blockchain");
const createLog = require("../../src/util/logger/supabaseLogger");
const { regsiterFeeWallet } = require("../../src/util/smartContract/registerWallet/registerFeeWallet");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");

const chainToRegister = [
    Chain.POLYGON_MAINNET
]


const createDeveloperUserAsyncCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
    
    if (!data || data.length <= 0) return true
    return false
}

const createDeveloperUserAsync = async(config) => {
    const userId = config.userId
    try{
        // Create customer objects for providers
        await Promise.all([
            createBastionDeveloperUser(userId),
            // createBusinessBridgeCustomer(userId), // FIXME business user can not yet be created successfully use individual instead for now
            createIndividualBridgeCustomer(userId), // use individual for now
            createCheckbookUser(userId)
        ]);

        // register fee wallet on payment processor contract
        await Promise.all(chainToRegister.map(async(chain) => {
            const walletAddress = await getBastionWallet(userId, chain, "FEE_COLLECTION")
            await regsiterFeeWallet(userId, walletAddress, chain)
        }))

    }catch (error){
        await createLog("createDeveloperUserAsync", userId, error.message)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    createDeveloperUserAsyncCheck,
    createDeveloperUserAsync
}