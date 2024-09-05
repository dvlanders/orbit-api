const supabase = require("../../supabaseClient")

const createPaymentBody = async(paymentConfig, accountId) => {
    // fetch account information
    const {data: accountProvider, error: accountProviderError} = await supabase
        .from("account_providers")
        .select("account_id")
        .eq("id", accountId)
        .single()
    
    if (accountProviderError) throw accountProviderError

    const {data: account, error: accountError} = await supabase
        .from("reap_accounts")
        .select(`
        id,
        created_at,
        updated_at,
        user_id,
        recipient_type,
        company_name,
        first_name,
        last_name,
        middle_name,
        legal_full_name,
        account_type,
        account_identifier_standard,
        account_identifier_value,
        network,
        currency,
        provider_name,
        provider_country,
        address_type,
        street,
        state,
        country,
        city,
        postal_code,
        provider_network_identifier
        `)
        .eq("id", accountProvider.account_id)
        .single()
    
    if (accountError) throw accountError

    // create body
    let recipientName
    if (account.recipient_type == "company"){
        recipientName = {
            name: account.company_name
        }
    }else if (account.recipient_type == "individual"){
        recipientName = {
            firstName: account.first_name,
            lastName: account.last_name,
            middleName: account.middle_name,
            legalFullName: account.legal_full_name
        }
    }

    const requestBody = {
        "receivingParty": {
            "type": account.recipient_type,
            "name": recipientName,
            "accounts": [
                {
                    "type": account.account_type,
                    "identifier": {
                        "standard": account.account_identifier_standard,
                        "value": account.account_identifier_value
                    },
                    "network": account.network,
                    "currencies": [
                        account.currency
                    ],
                    "provider": {
                        "name": account.provider_name,
                        "country": account.provider_country,
                        "networkIdentifier": account.provider_network_identifier
                    },
                    "addresses": [
                        {
                            "type": account.address_type,
                            "street": account.street,
                            "city": account.city,
                            "state": account.state,
                            "country": account.country,
                            "postalCode": account.postal_code
                        }
                    ]
                }
            ]
        },
        "payment": {
            "receivingAmount": paymentConfig.amount,
            "receivingCurrency": paymentConfig.destinationCurrency,
            "senderCurrency": paymentConfig.sourceCurrency,
            "description": paymentConfig.description,
            "purposeOfPayment": paymentConfig.purposeOfPayment
        }
    }

    return requestBody

}

module.exports = createPaymentBody