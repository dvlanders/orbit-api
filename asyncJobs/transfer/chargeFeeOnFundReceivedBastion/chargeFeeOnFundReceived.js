const { virtualAccountPaymentRailToChain } = require("../../../src/util/bridge/utils")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { approveMaxTokenToPaymentProcessor, paymentProcessorContractMap } = require("../../../src/util/smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { chargeFeeBastion } = require("../../../src/util/transfer/fiatToCrypto/transfer/chargeFeeBastion")
const { chargeFeeCircle } = require("../../../src/util/transfer/fee/chargeFeeCircle")
const { getUserWallet } = require("../../../src/util/user/getUserWallet")
const { JobError, JobErrorType } = require("../../error")
const { getRetryConfig } = require("../../retryJob")

exports.chargeFeeOnFundReceivedAsync = async(config) => {
    try{
        // fetch transferRecord
        const {data: onrampRecord, error: onrampRecordError} = await supabase
            .from("onramp_transactions")
            .select("*, developer_fees: developer_fee_id(*), bridge_transaction_info:bridge_transaction_record_id(*)")
            .eq("id", config.recordId)
            .single()
        
        if (onrampRecordError) throw onrampRecordError

        const feeRecord = onrampRecord.developer_fees
        const bridgeRecord = onrampRecord.bridge_transaction_info
        // fee already charged
        if (feeRecord.bastion_status == "CONFIRMED" || feeRecord.charged_status == "CONFIRMED") return 

        //get destination wallet address
        const {data: bridgeVirtualAccount, error: bridgeVirtualAccountError} = await supabase
            .from("bridge_virtual_accounts")
            .select("*")
            .eq("virtual_account_id", bridgeRecord.bridge_virtual_account_id)
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
            return {
                retryDetails: getRetryConfig(true, 60000, "Token approve amount not enough")
            }
        }

        // get user wallet and map to charge fee function
        const {walletProvider, circleWalletId} = await getUserWallet(onrampRecord.destination_user_id, chain)
        if (walletProvider == "BASTION"){
            await chargeFeeBastion(onrampRecord, feeRecord, paymentProcessorContractAddress, bridgeVirtualAccount.destination_wallet_address, transferAmount)
        }else if (walletProvider == "CIRCLE"){
            await chargeFeeCircle(onrampRecord, feeRecord, paymentProcessorContractAddress, bridgeVirtualAccount.destination_wallet_address, transferAmount, circleWalletId)
        }else{
            throw new Error("Unknown wallet provider")
        }

    }catch (error){
        if (error instanceof JobError) throw error
        await createLog("job/transfer/chargeFeeOnFundReceivedAsync", config.userId, error.message, error)
        // don't reSchedule
        throw new JobError(JobErrorType.INTERNAL_ERROR, error.message, null, error.message, false)
    }

}