const { createBridgeVirtualAccount } = require("../../bridge/endpoint/createBridgeVirtualAccount")
const { BridgeCustomerStatus, chainToVirtualAccountPaymentRail } = require("../../bridge/utils")
const { createCheckbookBankAccountForVirtualAccount } = require("../../checkbook/endpoint/createCheckbookBankAccount")
const { virtualAccountPaymentRailToChain } = require("../../bridge/utils")
const { createSingleCheckbookUser } = require("../../checkbook/endpoint/createCheckbookUser")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const checkUsAchOnRampRail = async(checkbookUserId) => {

    let { data: checkbook_accounts, error } = await supabaseCall(() => supabase
    .from('checkbook_accounts')
    .select('*')
    .eq("checkbook_user_id", checkbookUserId)
    .eq("connected_account_type", "BRIDGE_VIRTUAL_ACCOUNT")
    .maybeSingle()
    )

    if (error) throw error
    if (checkbook_accounts && checkbook_accounts.checkbook_id) return true
    return false
}

const getUserBridgeInfo = async(userId) => {
    let { data: bridge_customers, error } = await supabaseCall(() => supabase
        .from('bridge_customers')
        .select('*')
        .eq("user_id", userId)
        .maybeSingle())
    
    if (error) throw error
    return bridge_customers

}

const insertPreCheckbookAccountRecord = async(userId, virtualAccountInfo) => {
    const { data, error } = await supabase
        .from('checkbook_accounts')
        .upsert({
            account_number: virtualAccountInfo.deposit_institutions_bank_account_number,
            routing_number: virtualAccountInfo.deposit_institutions_bank_routing_number,
            user_id: userId,
            bridge_virtual_account_id: virtualAccountInfo.virtual_account_id,
            account_type: "CHECKING",
            connected_account_type: "BRIDGE_VIRTUAL_ACCOUNT",
        }, {onConflict: "bridge_virtual_account_id"})
        .select()

    if (error) throw error
    return
}

const activateUsAchOnRampRail = async(config) => {
    const {userId, destinationCurrency, destinationChain} = config
    try{
        // every time create a virtual account pairs will create a new checkbook user
        const checkbookUserId = `${userId}-${destinationChain}-${destinationCurrency}`
        // check if record is already exist
        if (await checkUsAchOnRampRail(checkbookUserId)) return {isCreated: false, alreadyExisted: true, isAllowedTocreate: false, virtualAccountInfo: null}
        // check if user is allowed to create 
        const userBridgeInfo = await getUserBridgeInfo(userId)
        if (!userBridgeInfo || userBridgeInfo.status != BridgeCustomerStatus.ACTIVE || userBridgeInfo.base_status != "approved") return {isCreated: false, alreadyExisted: false, isAllowedTocreate: false, virtualAccountInfo: null}
        //create bridge virtual account
        const rail = {
            sourceCurrency: "usd",
            sourcePaymentRail: "ach_push",
            destinationCurrency,
            destinationPaymentRail: chainToVirtualAccountPaymentRail[destinationChain]
        }
        const virtualAccount = await createBridgeVirtualAccount(userId, userBridgeInfo.bridge_id, rail)
        // get user name
        const {data: user, error: userError} = await supabase
            .from("user_kyc")
            .select("legal_first_name, legal_last_name")
            .eq("user_id", userId)
            .single()
        
        if (userError) throw userError
        // create new checkbook user
        await createSingleCheckbookUser(user, userId, checkbookUserId, "DESTINATION")
        // create checkbook account
        await insertPreCheckbookAccountRecord(userId, virtualAccount)
        const result = await createCheckbookBankAccountForVirtualAccount(checkbookUserId, virtualAccount.virtual_account_id, virtualAccount.deposit_institutions_bank_account_number, virtualAccount.deposit_institutions_bank_routing_number)
        if (result.status != 200) throw new Error(result.message)

        const virtualAccountInfo = {
            virtualAccountId: virtualAccount.id,
            userId: virtualAccount.user_id,
            paymentRail: virtualAccount.source_payment_rail,
            sourceCurrency: virtualAccount.source_currency,
            destinationChain: virtualAccountPaymentRailToChain[virtualAccount.destination_payment_rail],
            destinationCurrency: virtualAccount.destination_currency,
            destinationWalletAddress: virtualAccount.destination_wallet_address,
            railStatus: virtualAccount.status,
            depositInstructions: {
                bankName: virtualAccount.deposit_institutions_bank_name,
                routingNumber: virtualAccount.deposit_institutions_bank_routing_number,
                accountNumber: virtualAccount.deposit_institutions_bank_account_number,
                bankAddress: virtualAccount.deposit_institutions_bank_address
            }
        }

        return {isCreated: true, alreadyExisted: false, isAllowedTocreate: true, virtualAccountInfo}
    }catch(error){
        console.error(error)
        await createLog("account/util/activateUsAchOnRampRail", userId, error.message, error.rawResponse)
        throw error
    }
}

module.exports = activateUsAchOnRampRail