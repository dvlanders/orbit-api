const createJob = require("../../../../asyncJobs/createJob")
const createLog = require("../../logger/supabaseLogger")
const { paymentProcessorContractMap, MAX_APPROVE_TOKEN } = require("../../smartContract/approve/approveTokenBastion")

exports.allowanceCheck = async(userId, walletAddress, chain, currency) => {
    try{
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const allowance = await getTokenAllowance(chain, currency, walletAddress, paymentProcessorContractAddress)

        if (allowance < MAX_APPROVE_TOKEN / 2){
            await createJob("approveMaxTokenToPaymentProcessor", {userId, chain, currency, owner: walletAddress}, userId)
        }
    }catch (error){
        createLog("allowanceCheck", userId, error.message)
        return 
    }
}