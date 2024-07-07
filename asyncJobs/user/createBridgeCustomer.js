const { createBusinessBridgeCustomer } = require("../../src/util/bridge/endpoint/submitBusinessBridgeCustomerApplication")
const { createIndividualBridgeCustomer } = require("../../src/util/bridge/endpoint/submitIndividualBridgeCustomerApplication")
const createLog = require("../../src/util/logger/supabaseLogger")


const createBridgeCustomerAsync = async(config) => {
    try{
        if (config.userType == "business"){
            await createBusinessBridgeCustomer(config.userId)
        }else if(config.userType == "individual"){
            await createIndividualBridgeCustomer(config.userId)
        }
    }catch (error){
        createLog("createBridgeCustomerAsync", config.userId, error.message)
    }
}