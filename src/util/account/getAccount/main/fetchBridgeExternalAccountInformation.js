const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");


const fetchBridgeExternalAccountInformation = async(currency, accountId) => {
    const { data: bridgeExternalAccountData, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
    .from('bridge_external_accounts')
    .select('id, created_at, currency, bank_name, account_owner_name, account_owner_type, account_type, beneficiary_street_line_1, beneficiary_street_line_2, beneficiary_city, beneficiary_state, beneficiary_postal_code, beneficiary_country, iban, business_identifier_code, bank_country, account_number, routing_number')
    .eq('id', accountId)
    .eq('currency', currency)
    .maybeSingle()
    )

    if (bridgeExternalAccountError) throw bridgeExternalAccountError 
    if (!bridgeExternalAccountData) return null
    const bankInfo = {
        createdAt: bridgeExternalAccountData.created_at,
        currency: bridgeExternalAccountData.currency,
        bankName: bridgeExternalAccountData.bank_name,
        accountOwnerName: bridgeExternalAccountData.account_owner_name,
        accountOwnerType: bridgeExternalAccountData.account_owner_type,
        accountType: bridgeExternalAccountData.account_type,
        beneficiaryStreetLine1: bridgeExternalAccountData.beneficiary_street_line_1,
        beneficiaryStreetLine2: bridgeExternalAccountData.beneficiary_street_line_2,
        beneficiaryCity: bridgeExternalAccountData.beneficiary_city,
        beneficiaryState: bridgeExternalAccountData.beneficiary_state,
        beneficiaryPostalCode: bridgeExternalAccountData.beneficiary_postal_code,
        beneficiaryCountry: bridgeExternalAccountData.beneficiary_country,
        iban: bridgeExternalAccountData.iban,
        businessIdentifierCode: bridgeExternalAccountData.business_identifier_code,
        bankCountry: bridgeExternalAccountData.bank_country,
        accountNumber: bridgeExternalAccountData.account_number,
        routingNumber: bridgeExternalAccountData.routing_number,
    }

    return bankInfo;
}

module.exports = fetchBridgeExternalAccountInformation