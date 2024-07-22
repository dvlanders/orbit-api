const { getBastionWallet } = require("../../src/util/bastion/utils/getBastionWallet")
const createLog = require("../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../src/util/supabaseClient")
const { bastionCryptoTransfer } = require("../../src/util/transfer/cryptoToCrypto/main/bastionTransfer")
const { toUnitsString } = require("../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { JobError, JobErrorType } = require("../error")



const cryptoToCryptoTransferScheduleCheck = async(job, config, userId, profileId) => {

    const {data, error} = await supabase
        .from("jobs_queue")
        .select("*")
        .eq("job", job)
        .eq("user_id", userId)
        .order("created_at", {ascending: false})
    
    if (!data || data.length <= 0) return true
    for (const record of data){
        if (areObjectsEqual(record.config, config)) return false
    }

    return false
}

const cryptoToCryptoTransferAsync = async(config) => {

    try{
        const {data: record, error} = await supabase
            .from("crypto_to_crypto")
            .select("*")
            .eq("id", config.recordId)
            .single()
        
        if (error) throw error

        // check allowance if not enough perform a token approve job and reschedule transfer
        const unitsAmount = toUnitsString(fields.amount, decimal) 
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][fields.chain]
        const allowance = await getTokenAllowance(fields.chain, fields.currency, fields.senderAddress, paymentProcessorContractAddress)
        if (allowance < BigInt(unitsAmount)){
            await approveMaxTokenToPaymentProcessor(record.sender_user_id, record.chain, record.currency)
            throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true)
        }

        const senderAddress = await getBastionWallet(record.sender_user_id, record.chain)
        
        const fields = {
            profileId: config.profileId,
            senderAddress,
            recipientAddress: record.recipient_address,
            senderUserId: record.sender_user_id,
            amount: record.amount,
            requestId: record.requestId,
            recipientUserId: record.recipient_user_id, 
            recipientAddress: record.recipient_address, 
            chain: record.chain,
            currency: record.currency,
            feeType: config.feeType,
            feeValue: config.feeType,
        }

        await bastionCryptoTransfer(fields, record.id)

    }catch (error){
        if (error instanceof JobError) throw error
        createLog("job/transfer/cryptoToCryptoTransferAsync", config.userId, error.message)
        // don't reSchedule
        throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
    }

}


module.exports = {
    cryptoToCryptoTransferScheduleCheck,
    cryptoToCryptoTransferAsync
}