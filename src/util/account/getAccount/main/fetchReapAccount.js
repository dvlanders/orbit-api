const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const filledInfo = async(account) => {
    try{

        const {data: accountData, error: accountDataError} = await supabase
            .from("reap_accounts")
            .select()
            .eq("id", account.account_id)
            .maybeSingle()
        
        if (accountDataError) throw accountDataError
        if (!accountData) throw new Error(`no account found for id: ${account.id}`)
    
    
        return {
            accountId: account.id,
            userId: accountData.user_id,
            createdAt: accountData.created_at,
            currency: accountData.currency.toLowerCase(),
            bankName: accountData.provider_name,
            accountOwnerName: accountData.company_name || accountData.legal_full_name || `${accountData.first_name} ${accountData.last_name}`,
            accountOwnerType: accountData.recipient_type,
            accountType: null,
            beneficiaryStreetLine1: accountData.street,
            beneficiaryStreetLine2: null,
            beneficiaryCity: accountData.city,
            beneficiaryState: accountData.state,
            beneficiaryPostalCode: accountData.postal_code,
            beneficiaryCountry: accountData.country,
            bankCountry: accountData.provider_country,
            accountIdentifierType: accountData.account_identifier_standard,
            accountIdentifierValue: accountData.account_identifier_value
        }
    }catch (error){
        await createLog("reap/fetchReapAccountInformation/filledInfo", account.user_id, error.message, error)
        return null
    }
}


const fetchReapAccountInformation = async (currency, paymentRail, profileId, accountId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
	let allBanksInfo
	let bankInfo
    console.log({currency, paymentRail, profileId, accountId, userId})
    try{
        if (!accountId){
            if (userId){
                // fetch all record of an user
                let { data: accountData, error: accountDataError } = await supabaseCall(() => supabase
                    .from("account_providers")
                    .select("id, account_id, user_id")
                    .eq('currency', currency)
                    .eq('payment_rail', paymentRail)
                    .eq("user_id", userId)
                    .lt("created_at", createdBefore)
                    .gt("created_at", createdAfter)
                    .order("created_at", {ascending: false})
                    .limit(limit)
                    )
                    if (accountDataError) throw accountDataError
                    allBanksInfo = accountData

            }else{
                // fetch all records of an org
                let { data: accountData, error: accountDataError } = await supabaseCall(() => supabase
                    .from("account_providers")
                    .select('users: user_id!inner(id, profile_id), id, account_id, user_id')
                    .eq('currency', currency)
                    .eq('payment_rail', paymentRail)
                    .eq("users.profile_id", profileId)
                    .lt("created_at", createdBefore)
                    .gt("created_at", createdAfter)
                    .order("created_at", {ascending: false})
                    .limit(limit)
                    )
                    if (accountDataError) throw accountDataError
                    allBanksInfo = accountData
            }
        }else{
            // fetch single record
            const {data: accountData, error: accountDataError} = await supabase
                .from("account_providers")
                .select("id, account_id, user_id")
                .eq("id", accountId)
                .maybeSingle()

            if (accountDataError) throw accountDataError
            bankInfo = accountData
        }

        if (accountId && !bankInfo) return null
        if (bankInfo){
            return await filledInfo(bankInfo)
        }else if (allBanksInfo){
            return {
                count: allBanksInfo.length,
                banks: await Promise.all(allBanksInfo.map(async (bank) => await filledInfo(bank)))
            }
        }

        return null
    }catch (error){
        await createLog("account/fetchReapAccountInformation", userId, error.message, error, profileId)
        throw new Error("Error happened in fetchReapAccountInformation")
    }

}

module.exports = {
	fetchReapAccountInformation,
}