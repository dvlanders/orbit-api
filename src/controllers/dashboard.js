
const { transaction } = require("dynamoose");
const { getUserBalance } = require("../util/bastion/endpoints/getUserBalance");
const { currencyContractAddress } = require("../util/common/blockchain");
const { generateDailyTimeRanges, formatDateFromISOString, transformData } = require("../util/helper/dateTimeUtils");
const createLog = require("../util/logger/supabaseLogger");
const supabase = require("../util/supabaseClient");
const { feeMap } = require("../util/billing/feeRateMap");
const { calculateCustomerMonthlyBill } = require("../util/billing/customerBillCalculator");
const { supabaseCall } = require("../util/supabaseWithRetry");

exports.getWalletBalance = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });
    
        const {userId, chain, currency} = req.query
    try{
        const response = await getUserBalance(userId, chain)
        const responseBody = await response.json()
        if (!response.ok){
            createLog("dashboard/getWalletBalance", userId, "Something went wrong when getting wallet balance", responseBody)
            return res.status(500).json({ error: 'Internal server error' });
        }
        const currencyContract = currencyContractAddress[chain][currency].toLowerCase()
        const tokenInfo = responseBody.tokenBalances[currencyContract]
        if (!tokenInfo) return res.status(200).json({balance: 0, tokenInfo: null})

        return res.status(200).json({balance: tokenInfo.quantity, tokenInfo})

    }catch(error){
        console.error(error)
        await createLog("dashboard/getWalletBalance", userId, error.message, error)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getTotalTransactionVolume = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query

    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_total_crypto_to_crypto_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
          })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_total_crypto_to_fiat_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
          })
        if (cryptoToFiatError) throw cryptoToFiatError

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
        .rpc('get_total_fiat_to_crypto_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
            })
        if (fiatToCryptoError) throw fiatToCryptoError
        
        return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto });



    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionVolume", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getTotalTransactionVolumeHistory = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_daily_crypto_to_crypto_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        const cryptoToCryptoVol = transformData(cryptoToCrypto, "total_amount")

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_daily_crypto_to_fiat_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatError) throw cryptoToFiatError
        const cryptoToFiatVol = transformData(cryptoToFiat, "total_amount")

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
            .rpc('get_daily_fiat_to_crypto_transaction_volume', {
                end_date: endDate, 
                profile_id: profileId, 
                start_date: startDate
                })
        if (fiatToCryptoError) throw fiatToCryptoError
        const fiatToCryptoVol = transformData(fiatToCrypto, "total_amount")
        

        // Sum
        const currentDay = new Date().getDate();
        let prevTotalValue = 0
        let prevCryptoToCryptoValue = 0
        let prevCryptoToFiatValue = 0
        let prevFiatToCryptoValue = 0
        const accumulated = []

        for (let day = 1; day <= currentDay; day++) {
            let dayStr = day.toString();
            
            const dailyCryptoToCryptoVol = cryptoToCryptoVol.find(entry => entry.date === dayStr)?.value || 0;
            const dailyCryptoToFiatVol = cryptoToFiatVol.find(entry => entry.date === dayStr)?.value || 0;
            const dailyFiatToCryptoVol = fiatToCryptoVol.find(entry => entry.date === dayStr)?.value || 0;
            prevCryptoToCryptoValue += dailyCryptoToCryptoVol
            prevCryptoToFiatValue += dailyCryptoToFiatVol
            prevFiatToCryptoValue += dailyFiatToCryptoVol
            prevTotalValue += dailyCryptoToCryptoVol + dailyCryptoToFiatVol + dailyFiatToCryptoVol

            
            accumulated.push({date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Volume"})
        }

        return res.status(200).json({ history: accumulated});

    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionVolumeHistory", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getTotalTransactionAmount = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_total_crypto_to_crypto_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_total_crypto_to_fiat_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatError) throw cryptoToFiatError

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
        .rpc('get_total_fiat_to_crypto_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
            })
        if (fiatToCryptoError) throw fiatToCryptoError

        return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto });
    }catch (error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionAmount", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }
}

exports.getTotalTransactionAmountHistory = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_daily_crypto_to_crypto_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        const cryptoToCryptoAmount = transformData(cryptoToCrypto, "total_amount")
        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_daily_crypto_to_fiat_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatError) throw cryptoToFiatError
        const cryptoToFiatAmount = transformData(cryptoToFiat, "total_amount")
        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
            .rpc('get_daily_fiat_to_crypto_transaction_count', {
                end_date: endDate, 
                profile_id: profileId, 
                start_date: startDate
                })
        if (fiatToCryptoError) throw fiatToCryptoError
        const fiatToCryptoAmount = transformData(fiatToCrypto, "total_amount")

        // Sum
        const currentDay = new Date().getDate();
        let prevTotalValue = 0
        let prevCryptoToCryptoValue = 0
        let prevCryptoToFiatValue = 0
        let prevFiatToCryptoValue = 0
        const accumulated = []

        for (let day = 1; day <= currentDay; day++) {
            let dayStr = day.toString();
            
            const dailyCryptoToCryptoAmount = cryptoToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
            const dailyCryptoToFiatAmount = cryptoToFiatAmount.find(entry => entry.date === dayStr)?.value || 0;
            const dailyFiatToCryptoAmount = fiatToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
            prevCryptoToCryptoValue += dailyCryptoToCryptoAmount
            prevCryptoToFiatValue += dailyCryptoToFiatAmount
            prevFiatToCryptoValue += dailyFiatToCryptoAmount
            prevTotalValue += dailyCryptoToCryptoAmount + dailyCryptoToFiatAmount + dailyFiatToCryptoAmount

            
            accumulated.push({date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Amount"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Amount"})
            accumulated.push({date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Amount"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Amount"})
        }

        return res.status(200).json({ history: accumulated});

    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getAverageTransactionValue = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    try{
        const {profileId, startDate, endDate} = req.query
        // Volume
        // crypto to crypto
        const {data: cryptoToCryptoVol, error: cryptoToCryptoVolError} = await supabase
        .rpc('get_total_crypto_to_crypto_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoVolError) throw cryptoToCryptoVolError

        // crypto to fiat
        const {data: cryptoToFiatVol, error: cryptoToFiatVolError} = await supabase
        .rpc('get_total_crypto_to_fiat_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatVolError) throw cryptoToFiatVolError

        // fiat to crypto
        const {data: fiatToCryptoVol, error: fiatToCryptoVolError} = await supabase
        .rpc('get_total_fiat_to_crypto_transaction_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
            })
        if (fiatToCryptoVolError) throw fiatToCryptoVolError

        // Amount
        // crypto to crypto
        const {data: cryptoToCryptoAmount, error: cryptoToCryptoAmountError} = await supabase
        .rpc('get_total_crypto_to_crypto_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoAmountError) throw cryptoToCryptoAmountError

        // crypto to fiat
        const {data: cryptoToFiatAmount, error: cryptoToFiatAmountError} = await supabase
        .rpc('get_total_crypto_to_fiat_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatAmountError) throw cryptoToFiatAmountError

        // fiat to crypto
        const {data: fiatToCryptoAmount, error: fiatToCryptoAmountError} = await supabase
        .rpc('get_total_fiat_to_crypto_transaction_count', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
            })
        if (fiatToCryptoAmountError) throw fiatToCryptoAmountError
        const cryptoToCrypto = cryptoToCryptoVol/cryptoToCryptoAmount
        const cryptoToFiat =  cryptoToFiatVol / cryptoToFiatAmount
        const fiatToCrypto = fiatToCryptoVol / fiatToCryptoAmount
        const total = (cryptoToCryptoVol + cryptoToFiatVol + fiatToCryptoVol) / (cryptoToCryptoAmount + cryptoToFiatAmount + fiatToCryptoAmount)

        return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total});
    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getAverageTransactionValue", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }


}

exports.getAverageTransactionValueHistory = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_daily_crypto_to_crypto_transaction_avg_amount', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        const cryptoToCryptoAvg = transformData(cryptoToCrypto, "average_amount")
        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_daily_crypto_to_fiat_transaction_avg_amount', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate
        })
        if (cryptoToFiatError) throw cryptoToFiatError
        const cryptoToFiatAvg = transformData(cryptoToFiat, "average_amount")

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
            .rpc('get_daily_fiat_to_crypto_transaction_avg_amount', {
                end_date: endDate, 
                profile_id: profileId, 
                start_date: startDate
                })
        if (fiatToCryptoError) throw fiatToCryptoError
        const fiatToCryptoAvg = transformData(fiatToCrypto, "average_amount")

        // Map
        const currentDay = new Date().getDate();
        const avg = []

        for (let day = 1; day <= currentDay; day++) {
            let dayStr = day.toString();
            
            const dailyCryptoToCrypto = cryptoToCryptoAvg.find(entry => entry.date === dayStr)?.value || 0;
            const dailyCryptoToFiat = cryptoToFiatAvg.find(entry => entry.date === dayStr)?.value || 0;
            const dailyFiatToCrypto = fiatToCryptoAvg.find(entry => entry.date === dayStr)?.value || 0;

            
            // avg.push({date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume"})
            avg.push({date: dayStr, value: parseFloat(dailyCryptoToCrypto.toFixed(2)), category: "Wallet Transfer Avg."})
            avg.push({date: dayStr, value: parseFloat(dailyFiatToCrypto.toFixed(2)), category: "Fiat Deposit Avg."})
            avg.push({date: dayStr, value: parseFloat(dailyCryptoToFiat.toFixed(2)), category: "Stablecoin Withdraw Avg."})
        }

        return res.status(200).json({ history: avg});

    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getTotalDeveloperFeeVolume = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_total_developer_fees_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate,
            transfer_type: "CRYPTO_TO_CRYPTO"
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_total_developer_fees_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate,
            transfer_type: "CRYPTO_TO_FIAT"
        })
        if (cryptoToFiatError) throw cryptoToFiatError

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
        .rpc('get_total_developer_fees_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate,
            transfer_type: "FIAT_TO_CRYPTO"
            })
        if (fiatToCryptoError) throw fiatToCryptoError

        return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto });
    }catch (error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionAmount", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }
}

exports.getTotalDeveloperFeeVolumeHistory = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        // crypto to crypto
        const {data: cryptoToCrypto, error: cryptoToCryptoError} = await supabase
        .rpc('get_daily_developer_fees_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate,
            transfer_type: "CRYPTO_TO_CRYPTO"
        })
        if (cryptoToCryptoError) throw cryptoToCryptoError
        const cryptoToCryptoAmount = transformData(cryptoToCrypto, "total_amount")

        // crypto to fiat
        const {data: cryptoToFiat, error: cryptoToFiatError} = await supabase
        .rpc('get_daily_developer_fees_volume', {
            end_date: endDate, 
            profile_id: profileId, 
            start_date: startDate,
            transfer_type: "CRYPTO_TO_FIAT"
        })
        if (cryptoToFiatError) throw cryptoToFiatError
        const cryptoToFiatAmount = transformData(cryptoToFiat, "total_amount")

        // fiat to crypto
        const {data: fiatToCrypto, error: fiatToCryptoError} = await supabase
            .rpc('get_daily_developer_fees_volume', {
                end_date: endDate, 
                profile_id: profileId, 
                start_date: startDate,
                transfer_type: "FIAT_TO_CRYPTO"
                })
        if (fiatToCryptoError) throw fiatToCryptoError
        const fiatToCryptoAmount = transformData(fiatToCrypto, "total_amount")

        // Sum
        const currentDay = new Date().getDate();
        let prevTotalValue = 0
        let prevCryptoToCryptoValue = 0
        let prevCryptoToFiatValue = 0
        let prevFiatToCryptoValue = 0
        const accumulated = []

        for (let day = 1; day <= currentDay; day++) {
            let dayStr = day.toString();
            
            const dailyCryptoToCryptoAmount = cryptoToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
            const dailyCryptoToFiatAmount = cryptoToFiatAmount.find(entry => entry.date === dayStr)?.value || 0;
            const dailyFiatToCryptoAmount = fiatToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
            prevCryptoToCryptoValue += dailyCryptoToCryptoAmount
            prevCryptoToFiatValue += dailyCryptoToFiatAmount
            prevFiatToCryptoValue += dailyFiatToCryptoAmount
            prevTotalValue += dailyCryptoToCryptoAmount + dailyCryptoToFiatAmount + dailyFiatToCryptoAmount

            
            accumulated.push({date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Volume"})
            accumulated.push({date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Volume"})
        }

        return res.status(200).json({ history: accumulated});

    }catch(error){
        console.error(error)
        await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
        return res.status(500).json({ error: 'Internal server error' });
    }

}

exports.getCurrentBillingInformation = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, startDate, endDate} = req.query
    try{
        
        const billingInfo = await calculateCustomerMonthlyBill(profileId, startDate, endDate)

        return res.status(200).json(billingInfo)
    }catch (error){
        console.error(error)
        await createLog("dashboard/utils/getCurrentBillingInformation", null, error.message, null, profileId)
        return res.status(500).json({error: "Internal server error"})
    }

}

exports.getInvoiceHistory = async(req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

    const {profileId, createdAfter, createdBefore, limit} = req.query
    try{
        const invoiceCreatedAfter = createdAfter || new Date("1900-01-01").toISOString()
        const invoiceCreatedBefore= createdBefore || new Date("2200-01-01").toISOString()
        const invoiceLimit = limit || 10
        const {data, error} = await supabaseCall(() => supabase
            .from("billing_history")
            .select("id, created_at, final_billable_fee_amount, billing_documentation_url, hosted_billing_page_url, status, billing_email")
            .eq("profile_id", profileId)
            .lt("created_at", invoiceCreatedBefore)
            .gt("created_at", invoiceCreatedAfter)
            .order("created_at", {ascending: false})
            .limit(invoiceLimit))

        const records = data.map((d) => {
            return {
                id: d.id,
                createdAt: d.created_at,
                paymentAmount: d.final_billable_fee_amount,
                status: d.status,
                billingEmail: d.billing_email,
                billingDocumentationUrl: d.billing_documentation_url,
                hostedBillingPageUrl: d.hosted_billing_page_url
            }
        })

        return res.status(200).json({records: records})
    }catch (error){
        console.error(error)
        await createLog("dashboard/utils/getInvoiceHistory", null, error.message, null, profileId)
        return res.status(500).json({error: "Internal server error"})
    }
}