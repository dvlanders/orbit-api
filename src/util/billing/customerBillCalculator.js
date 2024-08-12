const createLog = require("../logger/supabaseLogger")
const supabase = require("../supabaseClient")
const { feeMap } = require("./feeRateMap")


exports.calculateCustomerMonthlyBill = async(profileId, startDate, endDate) => {
    try{
        // get customer billing rate
        const {data: billingRate, error: billingRateError} = await supabase
            .from("billing_information")
            .select("*")
            .eq("profile_id", profileId)
            .maybeSingle()
        
        if (!billingRate) throw new Error("No billing information found")
        if (billingRateError) throw billingRateError

         // crypto to crypto payout
         const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
         .rpc('get_total_crypto_to_crypto_transaction_payout', {
             end_date: endDate, 
             profile_id: profileId, 
             start_date: startDate
         })
         if (cryptoToCryptoError) throw cryptoToCryptoError

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_total_crypto_to_fiat_transaction_payout', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatError) throw cryptoToFiatError
        
        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
        .rpc('get_total_fiat_to_crypto_transaction_payout', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
            })
        if (fiatToCryptoError) throw fiatToCryptoError

        // get active user amount
        const {data: activeVirtualAccount, error: activeVirtualAccountError} = await supabase
        .rpc('get_record_count_with_user_id_presented', {
            profile_id: profileId,
            table_name: "bridge_virtual_accounts",
            end_date: endDate
            })
        if (activeVirtualAccountError) throw activeVirtualAccountError

        const billingInfo = {
            cryptoPayout:{
                value: cryptoToCrypto * billingRate.crypto_payout_fee_percent,
            },
            fiatPayout: {
                value: feeMap(cryptoToFiat, billingRate.fiat_payout_config)
            },
            fiatDeposit: {
                value: feeMap(fiatToCrypto, billingRate.fiat_deposit_config)
            },
            virtualAccount: {
                value: activeVirtualAccount * billingRate.active_virtual_account_fee
            },
            monthlyMinimum: billingRate.monthly_minimum,
            updatedAt: billingRate.updated_at,
            billingPeriodStart: startDate,
            billingPeriodEnd: endDate
        }


        billingInfo.total = billingInfo.cryptoPayout.value + billingInfo.fiatPayout.value + billingInfo.fiatDeposit.value + billingInfo.virtualAccount.value
        billingInfo.payoutTotal = {
            value: billingInfo.cryptoPayout.value + billingInfo.fiatPayout.value
        }
        return billingInfo
    }catch (error){
        console.error(error)
        await createLog("billing/calculateCustomerMonthlyBill", null, error.message, null, profileId)
        throw new Error("Something went wrong in calculateCustomerMonthlyBill")
    }
}