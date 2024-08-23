const bastionGasCheck = require("../../../src/util/bastion/utils/gasCheck")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const { executeAsyncBastionCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/bastionTransfer")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { JobError, JobErrorType } = require("../../error")

const cryptoToCryptoTransferAsync = async(config) => {

    try{
        const {data: record, error} = await supabase
            .from("crypto_to_crypto")
            .select("*")
            .eq("id", config.recordId)
            .single()
        
        if (error) throw error

        // gas check
        const { needFund, fundSubmitted } = await bastionGasCheck(record.sender_user_id, record.chain, record.transfer_from_wallet_type)
        if (needFund){
            throw new JobError(JobErrorType.RESCHEDULE, "wallet gas not enough", null, null, true, false)
        }

        // check allowance if not enough perform a token approve job and reschedule transfer
        if (record.developer_fee_id){
            const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.currency]) 
            const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][record.chain]
            const allowance = await getTokenAllowance(record.chain, record.currency, record.sender_address, paymentProcessorContractAddress)
            if (allowance < BigInt(unitsAmount)){
                await approveMaxTokenToPaymentProcessor(record.sender_user_id, record.chain, record.currency, record.transfer_from_wallet_type)
                throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true, false)
            }
        }
        
        await executeAsyncBastionCryptoTransfer(config)

    }catch (error){
        if (error instanceof JobError) throw error
        await createLog("job/transfer/cryptoToCryptoTransferAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
    }

}


module.exports = {
    cryptoToCryptoTransferAsync
}