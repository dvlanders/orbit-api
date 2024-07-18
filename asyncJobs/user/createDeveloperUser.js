const createAndFundBastionUser = require("../../src/util/bastion/main/createAndFundBastionUser");
const createBastionDeveloperUser = require("../../src/util/bastion/main/createBastionUserForDeveloperUser");
const { createBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/submitBusinessBridgeCustomerApplication");
const { createIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/submitIndividualBridgeCustomerApplication");
const { createCheckbookUser } = require("../../src/util/checkbook/endpoint/createCheckbookUser");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { JobError, JobErrorType } = require("../error");


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
    try{
        // Create customer objects for providers
        await Promise.all([
            createBastionDeveloperUser(config.userId),
            // createBusinessBridgeCustomer(config.userId), // FIXME business user can not yet be created successfully use individual instead for now
            createIndividualBridgeCustomer(config.userId), // use individual for now
            createCheckbookUser(config.userId)
        ]);

    }catch (error){
        await createLog("createDeveloperUserAsync", config.userId, error.message)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, "", "", true)
    }
}

module.exports = {
    createDeveloperUserAsyncCheck,
    createDeveloperUserAsync
}