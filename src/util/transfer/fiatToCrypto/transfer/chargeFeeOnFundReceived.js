const createJob = require("../../../../../asyncJobs/createJob")
const { chargeFeeOnFundReceivedScheduleCheck } = require("../../../../../asyncJobs/transfer/chargeFeeOnFundReceivedBastion/scheduleCheck")
const bastionGasCheck = require("../../../bastion/utils/gasCheck")
const { virtualAccountPaymentRailToChain } = require("../../../bridge/utils")
const { currencyDecimal } = require("../../../common/blockchain")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount")
const supabase = require("../../../supabaseClient")
const { getUserProfileId } = require("../../../user/getUser")
const { toUnitsString } = require("../../cryptoToCrypto/utils/toUnits")
const { chargeFeeBastion } = require("./chargeFeeBastion")


exports.chargeFeeOnFundReceivedBastion = async(transferRecordId) => {
    let userId
    try{
        
        // fetch transferRecord
        const {data: onrampRecord, error: onrampRecordError} = await supabase
        .from("onramp_transactions")
        .select("*, developer_fees: developer_fee_id(*), destination_user: destination_user_id(profile_id)")
        .eq("id", transferRecordId)
        .single()
        
        if (onrampRecordError) throw onrampRecordError

        const feeRecord = onrampRecord.developer_fees
        // fee already charged
        if (feeRecord.bastion_status == "CONFIRMED" || feeRecord.charged_status == "CONFIRMED") return 

        userId = onrampRecord.destination_user_id
        //get destination wallet address
        const {data: bridgeVirtualAccount, error: bridgeVirtualAccountError} = await supabase
            .from("bridge_virtual_accounts")
            .select("*")
            .eq("virtual_account_id", onrampRecord.bridge_virtual_account_id)
            .single()
        
        if (bridgeVirtualAccountError) throw bridgeVirtualAccountError
        // check allowance
        const chain = virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail]
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][chain]
        const allowance = await getTokenAllowance(chain, bridgeVirtualAccount.destination_currency, bridgeVirtualAccount.destination_wallet_address, paymentProcessorContractAddress)
		const decimals = currencyDecimal[bridgeVirtualAccount.destination_currency]
		const transferAmount = toUnitsString(onrampRecord.amount, decimals)
        if (allowance < BigInt(transferAmount)){
            // not enough allowance, perform a token allowance job and then schedule a token transfer job
            await approveMaxTokenToPaymentProcessor(onrampRecord.destination_user_id, chain, bridgeVirtualAccount.destination_currency)
            const canSchedule = await chargeFeeOnFundReceivedScheduleCheck("chargeFeeOnFundReceivedBastion", {recordId: transferRecordId}, onrampRecord.destination_user_id, onrampRecord.destination_user.profile_id)
            if (canSchedule){
                await createJob("chargeFeeOnFundReceivedBastion", {recordId: transferRecordId}, onrampRecord.destination_user_id, onrampRecord.destination_user.profile_id, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
            }
        }else{
            const info = {
                destinationWalletAddress: bridgeVirtualAccount.destination_wallet_address,
                transferAmount
            }
            await chargeFeeBastion(onrampRecord, feeRecord, paymentProcessorContractAddress, info)
        }
        // FIXME consider other wallet types
        const userProfileId = await getUserProfileId(onrampRecord.destination_user_id)
        await bastionGasCheck(onrampRecord.destination_user_id, chain, "INDIVIDUAL", userProfileId)

    }catch(error){
        console.error(error)
        await createLog("transfer/fiatToCrypto/chargeFeeOnFundReceivedBastion", userId, error.message)
        throw new Error("Error happened in chargeFeeOnFundReceivedBastion")
    }
}