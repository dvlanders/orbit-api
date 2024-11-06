const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../src/util/smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const { executeAsyncBastionCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/bastionTransfer")
const { executeAsyncCircleCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/circleTransfer")
const cryptoToCryptoSupportedFunctions = require("../../../src/util/transfer/cryptoToCrypto/utils/cryptoToCryptoSupportedFunctions")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { gasCheck } = require("../../../src/util/transfer/gas/main/gasCheck")
const { JobError, JobErrorType } = require("../../error")
const { getRetryConfig } = require("../../retryJob")

const cryptoToCryptoTransferAsync = async(config) => {

    try{
        const {data: record, error} = await supabase
            .from("crypto_to_crypto")
            .select("*")
            .eq("id", config.recordId)
            .single()
        
        if (error) throw error

        // gas check
        const { needFund, fundSubmitted } = await gasCheck(record.sender_user_id, record.chain, record.transfer_from_wallet_type, config.profileId)
        if (needFund){
            return {
                retryDetails: getRetryConfig(true, 60000, "wallet gas not enough")
            }
        }

        // check allowance if not enough perform a token approve job and reschedule transfer
        if (record.developer_fee_id){
            const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.currency]) 
            const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][record.chain]
            const allowance = await getTokenAllowance(record.chain, record.currency, record.sender_address, paymentProcessorContractAddress)
            if (allowance < BigInt(unitsAmount)){
                await approveMaxTokenToPaymentProcessor(record.sender_user_id, record.chain, record.currency, record.transfer_from_wallet_type)
                return {
                    retryDetails: getRetryConfig(true, 60000, "Token approve amount not enough")
                }
            }
        }
        
        const {asyncExecuteFunc} = cryptoToCryptoSupportedFunctions[record.chain][record.currency]
        if (!asyncExecuteFunc) throw new Error(`No transfer function found for trancation: ${record.id}`)
        await asyncExecuteFunc(config)

    }catch (error){
        if (error instanceof JobError) throw error
        await createLog("job/transfer/cryptoToCryptoTransferAsync", config.userId, error.message, error)
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
    }

}


module.exports = {
    cryptoToCryptoTransferAsync
}