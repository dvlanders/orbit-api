const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");

const currencyTableMap = {
    mwk: "yellowcard_momo_mwk_accounts",
    ngn: "yellowcard_bank_ngn_accounts",
    tzs: "yellowcard_momo_tzs_accounts",
    ugx: "yellowcard_bank_ugx_accounts",
    xaf: "yellowcard_momo_xaf_accounts",
    kes: "yellowcard_momo_kes_accounts",
    rwf: "yellowcard_momo_rwf_accounts",
    xof: "yellowcard_momo_xof_accounts",
    zmw: "yellowcard_momo_zmw_accounts",
}


const fetchYellowcardAccountInformation = async (currency, profileId, accountId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {

    try{
        const {data: accountData, error: accountDataError} = await supabase
            .from(currencyTableMap[currency])
            .select()
            .eq("id", accountId)
            .maybeSingle()
        
        if (accountDataError) throw accountDataError
        if (!accountData) throw new Error(`no account found for internal id: ${accountId}`)
    
    
        return {
            userId: accountData.user_id,
            createdAt: accountData.created_at,
            currency: currency.toLowerCase(),
            bankName: accountData.bank_name,
            kind: accountData.kind,
            accountHolderName: accountData.account_holder_name,
            accountHolderPhone: accountData.account_holder_phone || accountData.account_number,
            accountNumber: accountData.account_holder_phone && accountData.account_number,
        }
    } catch (error){
        await createLog("account/fetchYellowcardAccountInformation", userId, error.message, error, profileId)
        throw new Error("Error happened in fetchYellowcardAccountInformation")
    }

}

module.exports = {
	fetchYellowcardAccountInformation,
}