const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

const checkEuOffRampAccount = async(accountInfo) => {
    // check is bridge external account created
    const {data: externalAccount, error: externalAccountError} = await supabaseCall(() => supabase
        .from("bridge_external_accounts")
        .select("*")
        .match({iban: accountInfo.ibanAccountNumber, business_identifier_code: accountInfo.businessIdentifierCode, user_id: accountInfo.userId, currency: accountInfo.currency})
        .maybeSingle()
        )
    if (externalAccountError) throw externalAccountError
    if (!externalAccount) return {externalAccountExist: false, liquidationAddressExist: false, externalAccountRecordId: null}

    const externalAccountRecordId = externalAccount.id
    
    // check is liquidation address created
    const {data: liquidationAddress, error: liquidationAddressError} = await supabaseCall(() => supabase
        .from("bridge_liquidation_addresses")
        .select("*")
        .eq("external_account_id", externalAccountRecordId)
        .maybeSingle()
        )
    if (liquidationAddressError) throw liquidationAddressError
    if (!liquidationAddress) return {externalAccountExist: true, liquidationAddressExist: false, externalAccountRecordId: externalAccountRecordId}

    return {externalAccountExist: true, liquidationAddressExist: true, externalAccountRecordId: externalAccountRecordId}
}

module.exports = checkEuOffRampAccount