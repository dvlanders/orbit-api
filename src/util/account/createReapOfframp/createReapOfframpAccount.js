const { generateRailCompositeKey, getFetchRailFunctions } = require("../getAccount/utils/fetchRailFunctionMap")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")

const createReapOfframpAccount = async(config) => {
    const {
        userId,
		recipientType,
		companyName,
		firstName,
		lastName,
		middleName,
		legalFullName,
		accountType,
		accountIdentifierStandard,
		accountIdentifierValue,
		currency,
		bankName,
		bankCountry,
		bankCode,
		addressType,
		street,
		state,
		country,
		city,
		postalCode,
        network
	  } = config
    

    // insert in provider table
    const {data: hkAccount, error: hkAccountError} = await supabase
      .from("reap_accounts")
      .insert({
        user_id: userId,
        recipient_type: recipientType,
        company_name: companyName,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        legal_full_name: legalFullName,
        account_type: accountType,
        account_identifier_standard: accountIdentifierStandard,
        account_identifier_value: accountIdentifierValue,
        network: network,
        currency: currency.toUpperCase(),
        provider_name: bankName,
        provider_country: bankCountry,
        provider_network_identifier: bankCode,
        address_type: addressType,
        street: street,
        state: state,
        country: country,
        city: city,
        postal_code: postalCode,
        network: network.toUpperCase()
      })
      .select()
      .single()
    
    if (hkAccountError){
        console.error(hkAccountError)
        throw hkAccountError
    }
    // insert in index table
    const {data: accountProvider, error: accountProviderError} = await supabase
        .from("account_providers")
        .insert({
            id: hkAccount.id,
            account_id: hkAccount.id,
            user_id: userId,
            currency: currency,
            rail_type: "offramp",
            payment_rail: network,
            provider: "REAP"
        })
        .select()
        .single()
    
    if (accountProviderError) throw accountProviderError

    const railKey = generateRailCompositeKey(currency, "offramp", network)
    const func = getFetchRailFunctions(railKey);
	let accountInfo = await func(accountProvider.id)
    return accountInfo.banks[0]
}

module.exports = createReapOfframpAccount