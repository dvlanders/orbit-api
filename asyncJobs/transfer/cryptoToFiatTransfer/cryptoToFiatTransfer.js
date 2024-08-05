const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const {transferToBridgeLiquidationAddress} = require("../../../src/util/transfer/cryptoToBankAccount/transfer/transferToBridgeLiquidationAddress")
const { bastionCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/bastionTransfer")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { JobError, JobErrorType } = require("../../error")

exports.cryptoToFiatTransferAsync = async(config) => {

    try{
        const {data: record, error} = await supabase
            .from("offramp_transactions")
            .select("*")
            .eq("id", config.recordId)
            .single()
        
        if (error) throw error

        // check allowance if not enough perform a token approve job and reschedule transfer
        const unitsAmount = toUnitsString(record.amount, currencyDecimal[config.sourceCurrency]) 
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][record.chain]
        const sourceWalletAddress = await getBastionWallet(record.user_id, record.chain)
        const allowance = await getTokenAllowance(record.chain, config.sourceCurrency, sourceWalletAddress, paymentProcessorContractAddress)
        if (allowance < BigInt(unitsAmount)){
            await approveMaxTokenToPaymentProcessor(record.user_id, record.chain, config.sourceCurrency)
            throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true)
        }

        await transferToBridgeLiquidationAddress(record.request_id, record.user_id, record.destination_user_id, config.destinationAccountId, config.sourceCurrency, config.destinationCurrency, record.chain, record.amount, record.from_wallet_address, config.profileId, config.feeType, config.feeValue, record.id)

    }catch (error){
        console.error(error)
        if (error instanceof JobError) throw error
        await createLog("job/transfer/cryptoToFiatTransferAsync", config.userId, error.message, error)
        // don't reSchedule
        throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
    }

}

