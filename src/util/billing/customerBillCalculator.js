const createLog = require("../logger/supabaseLogger")
const supabase = require("../supabaseClient")
const { transferType } = require("../transfer/utils/transfer")
const { getTotalBalanceTopups, getBalance } = require("./balance/balanceService")
const { getKycKybAmount } = require("./user/getKycKybAmount")

const getTotalCryptoToCryptofee = async(profileId, startDate, endDate, status) => {
    const {data, error} = await supabase
        .rpc("get_fee_transactions_sum", {
            profile_id: profileId,
            start_date: startDate,
            end_date: endDate,
            transaction_type: transferType.CRYPTO_TO_CRYPTO,
            status: status
        })
    if (error) throw error
    return data
}

const getTotalCryptoToFiatfee = async(profileId, startDate, endDate, status) => {
    const {data, error} = await supabase
        .rpc("get_fee_transactions_sum", {
            profile_id: profileId,
            start_date: startDate,
            end_date: endDate,
            transaction_type: transferType.CRYPTO_TO_FIAT,
            status: status
        })
    if (error) throw error
    return data
}

const getTotalFiatToCryptoFee = async(profileId, startDate, endDate, status) => {
    const {data, error} = await supabase
        .rpc("get_fee_transactions_sum", {
            profile_id: profileId,
            start_date: startDate,
            end_date: endDate,
            transaction_type: transferType.FIAT_TO_CRYPTO,
            status: status
        })
    if (error) throw error
    return data
}


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

        const [cryptoToCryptoSuccess, cryptoToCryptoFailed, cryptoToFiatSuccess, cryptoToFiatFailed, fiatToCryptoSuccess, fiatToCryptoFailed] = await Promise.all([
            getTotalCryptoToCryptofee(profileId, startDate, endDate, "COMPLETED"),
            getTotalCryptoToCryptofee(profileId, startDate, endDate, "FAILED"),
            getTotalCryptoToFiatfee(profileId, startDate, endDate, "COMPLETED"),
            getTotalCryptoToFiatfee(profileId, startDate, endDate, "FAILED"),
            getTotalFiatToCryptoFee(profileId, startDate, endDate, "COMPLETED"),
            getTotalFiatToCryptoFee(profileId, startDate, endDate, "FAILED")
        ])

        // get active virtual account amount
        const {count: activeVirtualAccount, error: activeVirtualAccountError} = await supabase
            .from("bridge_virtual_accounts")
            .select("*, users!inner(profile_id)", {count: 'exact', head: true})
            .eq("users.profile_id", profileId)
            .gt("last_activity_time", startDate)
            .lt("last_activity_time", endDate)
        if (activeVirtualAccountError) throw activeVirtualAccountError

        // get active user amount
        const {count: activeUser, error: activeUserError} = await supabase
            .from("users")
            .select("*", {count: 'exact', head: true})
            .eq("profile_id", profileId)
            .gte("last_activity_time", startDate)
        if (activeUserError) throw activeUserError

        // get total topups
        const totalTopUps = await getTotalBalanceTopups(profileId, startDate, endDate)

        // get kyc kyb amount
        const [kycAmount, kybAmount] = await Promise.all([
            getKycKybAmount(profileId, startDate, endDate, "individual"),
            getKycKybAmount(profileId, startDate, endDate, "business")
        ])

        // get balance left
        const balance = await getBalance(profileId)

        const billingInfo = {
            cryptoPayout:{
                value: cryptoToCryptoSuccess + cryptoToCryptoFailed || 0,
                success: cryptoToCryptoSuccess || 0,
                failed: cryptoToCryptoFailed || 0
            },
            fiatPayout: {
                value: cryptoToFiatSuccess + cryptoToFiatFailed || 0,
                success: cryptoToFiatSuccess || 0,
                failed: cryptoToFiatFailed || 0
            },
            fiatDeposit: {
                value: fiatToCryptoSuccess + fiatToCryptoFailed || 0,
                success: fiatToCryptoSuccess || 0,
                failed: fiatToCryptoFailed || 0
            },
            virtualAccount: {
                value: activeVirtualAccount * billingRate.active_virtual_account_fee || 0
            },
            activeUser: {
                value: activeUser * billingRate.active_user_fee || 0
            },
            kycKyb: {
                value: (kycAmount * billingRate.kyc_fee) || 0 + (kybAmount * billingRate.kyb_fee) || 0
            },
            monthlyMinimum: billingRate.monthly_minimum,
            integrationFee: billingRate.integration_fee,
            platformFee: billingRate.platform_fee,
            totalTopUps,
            updatedAt: billingRate.updated_at,
            billingPeriodStart: startDate,
            billingPeriodEnd: endDate,
            balance:{
                id: balance.id,
                balanceLeft: balance.balance || 0
            }
        }


        billingInfo.total = billingInfo.cryptoPayout.value + billingInfo.fiatPayout.value + billingInfo.fiatDeposit.value + billingInfo.virtualAccount.value + billingInfo.kycKyb.value + billingInfo.activeUser.value
        billingInfo.totalTransactionFeeSuccess = billingInfo.cryptoPayout.success + billingInfo.fiatPayout.success + billingInfo.fiatDeposit.success
        billingInfo.totalTransactionFeeFailed = billingInfo.cryptoPayout.failed + billingInfo.fiatPayout.failed + billingInfo.fiatDeposit.failed
        billingInfo.payoutTotal = {
            value: billingInfo.cryptoPayout.value + billingInfo.fiatPayout.value
        }
        return billingInfo
    }catch (error){
        await createLog("billing/calculateCustomerMonthlyBill", null, error.message, null, profileId)
        throw new Error("Something went wrong in calculateCustomerMonthlyBill")
    }
}