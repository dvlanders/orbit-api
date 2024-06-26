const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")


const fetchPlaidAccountInformation = async(accountId) => {
    let { data: checkbookAccount, error } = await supabaseCall(() => supabase
    .from('checkbook_accounts')
    .select('id, created_at, account_type, account_number, routing_number, bank_name')
    .eq("id", accountId)
    .eq("connected_account_type", "PLAID")
    .maybeSingle())

    if (error) throw error
    if (!checkbookAccount) return null

    const bankInfo = {
        id: checkbookAccount.id,
        createdAt: checkbookAccount.createdAt,
        accountType: checkbookAccount.account_type,
        accountNumber: checkbookAccount.account_number,
        routingNumber: checkbookAccount.routing_number,
        bankName: checkbookAccount.bank_name,
    }

    return bankInfo
}

module.exports = fetchPlaidAccountInformation