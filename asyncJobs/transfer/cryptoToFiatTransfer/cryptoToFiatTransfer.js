const { fetchAccountProviders } = require("../../../src/util/account/accountProviders/accountProvidersService")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const {transferToBridgeLiquidationAddress} = require("../../../src/util/transfer/cryptoToBankAccount/transfer/transferToBridgeLiquidationAddress")
const { executeAsyncTransferCryptoToFiat } = require("../../../src/util/transfer/cryptoToBankAccount/transfer/transferToBridgeLiquidationAddressV2")
const { bastionCryptoTransfer } = require("../../../src/util/transfer/cryptoToCrypto/main/bastionTransfer")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { JobError, JobErrorType } = require("../../error")

exports.cryptoToFiatTransferAsync = async(config) => {

    try{
        // fetch record
        const {data: record, error} = await supabase
            .from("offramp_transactions")
            .select("*")
            .eq("id", config.recordId)
            .single()
        
        if (error) throw error

        // check allowance if not enough perform a token approve job and reschedule transfer
        if (record.developer_fee_id){
            const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.source_currency]) 
            const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][record.chain]
            const sourceWalletAddress = await getBastionWallet(record.user_id, record.chain)
            const allowance = await getTokenAllowance(record.chain, record.source_currency, sourceWalletAddress, paymentProcessorContractAddress)
            if (allowance < BigInt(unitsAmount)){
                await approveMaxTokenToPaymentProcessor(record.user_id, record.chain, record.source_currency)
                throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true)
            }
        }

        const transferConfig = {profileId: config.profileId, recordId: record.id}

        await executeAsyncTransferCryptoToFiat(transferConfig)

    }catch (error){
        console.error(error)
        if (error instanceof JobError) throw error
        await createLog("job/transfer/cryptoToFiatTransferAsync", config.userId, error.message, error)
        // don't reSchedule
        throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
    }

}

