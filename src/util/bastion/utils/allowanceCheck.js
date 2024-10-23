const createJob = require("../../../../asyncJobs/createJob")
const createLog = require("../../logger/supabaseLogger")
const { paymentProcessorContractMap, MAX_APPROVE_TOKEN } = require("../../smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../smartContract/approve/getApproveAmount")

exports.allowanceCheck = async(userId, walletAddress, chain, currency) => {
    try{
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const allowance = await getTokenAllowance(chain, currency, walletAddress, paymentProcessorContractAddress)

        if (allowance < MAX_APPROVE_TOKEN / 2){
            const jobConfig = {userId, chain, currency, owner: walletAddress}
            await createJob("approveMaxTokenToPaymentProcessor", jobConfig, userId, null)
        }
    }catch (error){
        await createLog("allowanceCheck", userId, error.message)
        return 
    }
}