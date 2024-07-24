const { virtualAccountPaymentRailToChain } = require("../../../src/util/bridge/utils")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { approveMaxTokenToPaymentProcessor, paymentProcessorContractMap } = require("../../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { chargeFeeBastion } = require("../../../src/util/transfer/fiatToCrypto/transfer/chargeFeeBastion")
const { JobError, JobErrorType } = require("../../error")



exports.chargeFeeOnFundReceivedBastionAsync = async(config) => {
    try{
        // fetch transferRecord
        const {data: onrampRecord, error: onrampRecordError} = await supabase
            .from("onramp_transactions")
            .select("*, developer_fees: developer_fee_id(*)")
            .eq("id", config.recordId)
            .single()
        
        if (onrampRecordError) throw onrampRecordError

        const feeRecord = onrampRecord.developer_fees

        //get destination wallet address
        const {data: bridgeVirtualAccount, error: bridgeVirtualAccountError} = await supabase
            .from("bridge_virtual_accounts")
            .select("*")
            .eq("virtual_account_id", onrampRecord.bridge_virtual_account_id)
            .single()
        
        if (bridgeVirtualAccountError) throw bridgeVirtualAccountError

        const chain = virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail]
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const allowance = await getTokenAllowance(chain, bridgeVirtualAccount.destination_currency, bridgeVirtualAccount.destination_wallet_address, paymentProcessorContractAddress)
		const decimals = currencyDecimal[bridgeVirtualAccount.destination_currency]
		const transferAmount = toUnitsString(onrampRecord.amount, decimals)

        if (allowance < BigInt(transferAmount)){
            // not enough allowance, perform a token allowance job and then schedule a token transfer job
            await approveMaxTokenToPaymentProcessor(onrampRecord.destination_user_id, chain, bridgeVirtualAccount.destination_currency)
            throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true)
        }

        const info = {
            destinationWalletAddress: bridgeVirtualAccount.destination_wallet_address,
            transferAmount
        }

        await chargeFeeBastion(onrampRecord, feeRecord, paymentProcessorContractAddress, info)

    }catch (error){
        console.error(error)
        if (error instanceof JobError) throw error
        createLog("job/transfer/chargeFeeOnFundReceivedBastionAsync", config.userId, error.message)
        // don't reSchedule
        throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, true)
    }

}