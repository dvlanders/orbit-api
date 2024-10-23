const createJob = require("../../../../asyncJobs/createJob")
const { approveMaxTokenToPaymentProcessorAsyncCheck } = require("../../../../asyncJobs/wallets/approveMaxToPaymentProcessor")
const createLog = require("../../logger/supabaseLogger")
const { paymentProcessorContractMap, MAX_APPROVE_TOKEN } = require("../../smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../smartContract/approve/getApproveAmount")

exports.allowanceCheck = async(userId, walletAddress, chain, currency) => {
    try{
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const allowance = await getTokenAllowance(chain, currency, walletAddress, paymentProcessorContractAddress)

        if (allowance < MAX_APPROVE_TOKEN / 2){
            const canSchedule = await approveMaxTokenToPaymentProcessorAsyncCheck("approveMaxTokenToPaymentProcessor", {userId, chain, currency, owner: walletAddress}, userId)
            if (canSchedule){
                await createJob("approveMaxTokenToPaymentProcessor", {userId, chain, currency, owner: walletAddress}, userId)
            }
        }
    }catch (error){
        await createLog("allowanceCheck", userId, error.message)
        return 
    }
}