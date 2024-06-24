const { createBridgeVirtualAccount } = require("../../bridge/endpoint/createBridgeVirtualAccount")
const { BridgeCustomerStatus } = require("../../bridge/utils")
const { createCheckbookBankAccountForVirtualAccount } = require("../../checkbook/endpoint/createCheckbookBankAccount")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const checkUsAchOnRampRail = async(userId) => {

    let { data: checkbook_accounts, error } = await supabaseCall(() => supabase
    .from('checkbook_accounts')
    .select('*')
    .eq("user_id", userId)
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
            connected_account_type: "BRIDGE_VIRTUAL_ACCOUNT",
        }, {onConflict: "bridge_virtual_account_id"})
        .select()
    if (error) throw error
    return
}



const activateUsAchOnRampRail = async(userId) => {
    try{
        // check if record is already exist
        if (await checkUsAchOnRampRail(userId)) return {isCreated: false, alreadyExisted: true, isAllowedTocreate: false}
        // check if user is allowed to create 
        const userBridgeInfo = await getUserBridgeInfo(userId)
        if (!userBridgeInfo || userBridgeInfo.status != BridgeCustomerStatus.ACTIVE || userBridgeInfo.base_status != "approved") return {isCreated: false, alreadyExisted: false, isAllowedTocreate: false}
        //create bridge virtual account
        const rail = {
            sourceCurrency: "usd",
            sourcePaymentRail: "ach",
            destinationCurrency: "usdc",
            destinationPaymentRail: "polygon"
        }
        const virtualAccount = await createBridgeVirtualAccount(userId, userBridgeInfo.bridge_id, rail)
        console.log(virtualAccount)
        // create checkbook account
        await insertPreCheckbookAccountRecord(userId, virtualAccount)
        const result = await createCheckbookBankAccountForVirtualAccount(userId, virtualAccount.virtual_account_id, virtualAccount.deposit_institutions_bank_account_number, virtualAccount.deposit_institutions_bank_routing_number)
        if (result.status != 200) throw new Error(result.message)
        return {isCreated: true, alreadyExisted: false, isAllowedTocreate: true}
    }catch(error){
        console.error()
        createLog("account/util/activateUsAchOnRampRail", userId, error.message, error.rawResponse)
        throw error
    }
}

module.exports = activateUsAchOnRampRail