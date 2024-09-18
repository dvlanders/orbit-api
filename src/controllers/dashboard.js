
const { transaction } = require("dynamoose");
const { getUserBalance } = require("../util/bastion/endpoints/getUserBalance");
const { currencyContractAddress } = require("../util/common/blockchain");
const { generateDailyTimeRanges, formatDateFromISOString, transformData, generateDatesFromStartToCurrent } = require("../util/helper/dateTimeUtils");
const createLog = require("../util/logger/supabaseLogger");
const supabase = require("../util/supabaseClient");
const { feeMap } = require("../util/billing/feeRateMap");
const { calculateCustomerMonthlyBill } = require("../util/billing/customerBillCalculator");
const { supabaseCall } = require("../util/supabaseWithRetry");
const { v4 } = require('uuid');
const tutorialCheckList = require("../util/dashboard/tutorialCheckList");
const getBillingPeriod = require("../util/billing/getBillingPeriod");

exports.getWalletBalance = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { userId, chain, currency, walletType } = req.query
	try {
		let { bastionUserId: bastionUserId } = await getBastionWallet(userId, chain, walletType)

		const response = await getUserBalance(bastionUserId, chain)
		const responseBody = await response.json()
		if (!response.ok) {
			createLog("dashboard/getWalletBalance", userId, "Something went wrong when getting wallet balance", responseBody)
			return res.status(500).json({ error: 'Internal server error' });
		}
		const currencyContract = currencyContractAddress[chain][currency].toLowerCase()
		const tokenInfo = responseBody.tokenBalances[currencyContract]
		if (!tokenInfo) return res.status(200).json({ balance: "0", tokenInfo: null })

		return res.status(200).json({ balance: tokenInfo.quantity, tokenInfo })

	} catch (error) {
		console.error(error)
		await createLog("dashboard/getWalletBalance", userId, error.message, error)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getTotalTransactionVolume = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query

	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_total_crypto_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_total_crypto_to_fiat_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatError) throw cryptoToFiatError

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_total_fiat_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoError) throw fiatToCryptoError

		return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto, periodStartDate: startDate, periodEndDate: endDate });



	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionVolume", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getTotalTransactionVolumeHistory = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_daily_crypto_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		const cryptoToCryptoVol = await transformData(cryptoToCrypto, "total_amount", startDate)

		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_daily_crypto_to_fiat_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatError) throw cryptoToFiatError
		const cryptoToFiatVol = await transformData(cryptoToFiat, "total_amount", startDate)

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_daily_fiat_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoError) throw fiatToCryptoError
		const fiatToCryptoVol = await transformData(fiatToCrypto, "total_amount", startDate)


		// Sum
		const dateList = generateDatesFromStartToCurrent(startDate)
		let prevTotalValue = 0
		let prevCryptoToCryptoValue = 0
		let prevCryptoToFiatValue = 0
		let prevFiatToCryptoValue = 0
		const accumulated = []
		for (dayStr of dateList) {
			const dailyCryptoToCryptoVol = cryptoToCryptoVol.find(entry => entry.date === dayStr)?.value || 0;
			const dailyCryptoToFiatVol = cryptoToFiatVol.find(entry => entry.date === dayStr)?.value || 0;
			const dailyFiatToCryptoVol = fiatToCryptoVol.find(entry => entry.date === dayStr)?.value || 0;
			prevCryptoToCryptoValue += dailyCryptoToCryptoVol
			prevCryptoToFiatValue += dailyCryptoToFiatVol
			prevFiatToCryptoValue += dailyFiatToCryptoVol
			prevTotalValue += dailyCryptoToCryptoVol + dailyCryptoToFiatVol + dailyFiatToCryptoVol


			accumulated.push({ date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Volume" })
		}

		return res.status(200).json({ history: accumulated, periodStartDate: startDate, periodEndDate: endDate });

	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionVolumeHistory", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getTotalTransactionAmount = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_total_crypto_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_total_crypto_to_fiat_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatError) throw cryptoToFiatError

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_total_fiat_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoError) throw fiatToCryptoError

		return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto, periodStartDate: startDate, periodEndDate: endDate });
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionAmount", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}
}

exports.getTotalTransactionAmountHistory = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_daily_crypto_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		const cryptoToCryptoAmount = await transformData(cryptoToCrypto, "total_amount", startDate)
		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_daily_crypto_to_fiat_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatError) throw cryptoToFiatError
		const cryptoToFiatAmount = await transformData(cryptoToFiat, "total_amount", startDate)
		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_daily_fiat_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoError) throw fiatToCryptoError
		const fiatToCryptoAmount = await transformData(fiatToCrypto, "total_amount", startDate)

		// Sum
		const dateList = generateDatesFromStartToCurrent(startDate)
		let prevTotalValue = 0
		let prevCryptoToCryptoValue = 0
		let prevCryptoToFiatValue = 0
		let prevFiatToCryptoValue = 0
		const accumulated = []

		for (dayStr of dateList) {

			const dailyCryptoToCryptoAmount = cryptoToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
			const dailyCryptoToFiatAmount = cryptoToFiatAmount.find(entry => entry.date === dayStr)?.value || 0;
			const dailyFiatToCryptoAmount = fiatToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
			prevCryptoToCryptoValue += dailyCryptoToCryptoAmount
			prevCryptoToFiatValue += dailyCryptoToFiatAmount
			prevFiatToCryptoValue += dailyFiatToCryptoAmount
			prevTotalValue += dailyCryptoToCryptoAmount + dailyCryptoToFiatAmount + dailyFiatToCryptoAmount


			accumulated.push({ date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Amount" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Amount" })
			accumulated.push({ date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Amount" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Amount" })
		}

		return res.status(200).json({ history: accumulated, periodStartDate: startDate, periodEndDate: endDate });

	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getAverageTransactionValue = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// Volume
		// crypto to crypto
		const { data: cryptoToCryptoVol, error: cryptoToCryptoVolError } = await supabase
			.rpc('get_total_crypto_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoVolError) throw cryptoToCryptoVolError

		// crypto to fiat
		const { data: cryptoToFiatVol, error: cryptoToFiatVolError } = await supabase
			.rpc('get_total_crypto_to_fiat_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatVolError) throw cryptoToFiatVolError

		// fiat to crypto
		const { data: fiatToCryptoVol, error: fiatToCryptoVolError } = await supabase
			.rpc('get_total_fiat_to_crypto_transaction_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoVolError) throw fiatToCryptoVolError

		// Amount
		// crypto to crypto
		const { data: cryptoToCryptoAmount, error: cryptoToCryptoAmountError } = await supabase
			.rpc('get_total_crypto_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoAmountError) throw cryptoToCryptoAmountError

		// crypto to fiat
		const { data: cryptoToFiatAmount, error: cryptoToFiatAmountError } = await supabase
			.rpc('get_total_crypto_to_fiat_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatAmountError) throw cryptoToFiatAmountError

		// fiat to crypto
		const { data: fiatToCryptoAmount, error: fiatToCryptoAmountError } = await supabase
			.rpc('get_total_fiat_to_crypto_transaction_count', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoAmountError) throw fiatToCryptoAmountError
		const cryptoToCrypto = cryptoToCryptoVol / cryptoToCryptoAmount
		const cryptoToFiat = cryptoToFiatVol / cryptoToFiatAmount
		const fiatToCrypto = fiatToCryptoVol / fiatToCryptoAmount
		const total = (cryptoToCryptoVol + cryptoToFiatVol + fiatToCryptoVol) / (cryptoToCryptoAmount + cryptoToFiatAmount + fiatToCryptoAmount)

		return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total, periodStartDate: startDate, periodEndDate: endDate });
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getAverageTransactionValue", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}


}

exports.getAverageTransactionValueHistory = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_daily_crypto_to_crypto_transaction_avg_amount', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		const cryptoToCryptoAvg = await transformData(cryptoToCrypto, "average_amount", startDate)
		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_daily_crypto_to_fiat_transaction_avg_amount', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (cryptoToFiatError) throw cryptoToFiatError
		const cryptoToFiatAvg = await transformData(cryptoToFiat, "average_amount", startDate)

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_daily_fiat_to_crypto_transaction_avg_amount', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate
			})
		if (fiatToCryptoError) throw fiatToCryptoError
		const fiatToCryptoAvg = await transformData(fiatToCrypto, "average_amount", startDate)

		// Map
		const dateList = generateDatesFromStartToCurrent(startDate)
		const avg = []

		for (dayStr of dateList) {

			const dailyCryptoToCrypto = cryptoToCryptoAvg.find(entry => entry.date === dayStr)?.value || 0;
			const dailyCryptoToFiat = cryptoToFiatAvg.find(entry => entry.date === dayStr)?.value || 0;
			const dailyFiatToCrypto = fiatToCryptoAvg.find(entry => entry.date === dayStr)?.value || 0;


			// avg.push({date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume"})
			avg.push({ date: dayStr, value: parseFloat(dailyCryptoToCrypto.toFixed(2)), category: "Wallet Transfer Avg." })
			avg.push({ date: dayStr, value: parseFloat(dailyFiatToCrypto.toFixed(2)), category: "Fiat Deposit Avg." })
			avg.push({ date: dayStr, value: parseFloat(dailyCryptoToFiat.toFixed(2)), category: "Stablecoin Withdraw Avg." })
		}

		return res.status(200).json({ history: avg, periodStartDate: startDate, periodEndDate: endDate });

	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getTotalDeveloperFeeVolume = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_total_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "CRYPTO_TO_CRYPTO"
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError

		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_total_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "CRYPTO_TO_FIAT"
			})
		if (cryptoToFiatError) throw cryptoToFiatError

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_total_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "FIAT_TO_CRYPTO"
			})
		if (fiatToCryptoError) throw fiatToCryptoError

		return res.status(200).json({ cryptoToCrypto, cryptoToFiat, fiatToCrypto, total: cryptoToCrypto + cryptoToFiat + fiatToCrypto, periodStartDate: startDate, periodEndDate: endDate });
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionAmount", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}
}

exports.getTotalDeveloperFeeVolumeHistory = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		const { startDate, endDate } = await getBillingPeriod(profileId)
		// crypto to crypto
		const { data: cryptoToCrypto, error: cryptoToCryptoError } = await supabase
			.rpc('get_daily_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "CRYPTO_TO_CRYPTO"
			})
		if (cryptoToCryptoError) throw cryptoToCryptoError
		const cryptoToCryptoAmount = await transformData(cryptoToCrypto, "total_amount", startDate)

		// crypto to fiat
		const { data: cryptoToFiat, error: cryptoToFiatError } = await supabase
			.rpc('get_daily_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "CRYPTO_TO_FIAT"
			})
		if (cryptoToFiatError) throw cryptoToFiatError
		const cryptoToFiatAmount = await transformData(cryptoToFiat, "total_amount", startDate)

		// fiat to crypto
		const { data: fiatToCrypto, error: fiatToCryptoError } = await supabase
			.rpc('get_daily_developer_fees_volume', {
				end_date: endDate,
				profile_id: profileId,
				start_date: startDate,
				transfer_type: "FIAT_TO_CRYPTO"
			})
		if (fiatToCryptoError) throw fiatToCryptoError
		const fiatToCryptoAmount = await transformData(fiatToCrypto, "total_amount", startDate)

		// Sum
		const dateList = generateDatesFromStartToCurrent(startDate)
		let prevTotalValue = 0
		let prevCryptoToCryptoValue = 0
		let prevCryptoToFiatValue = 0
		let prevFiatToCryptoValue = 0
		const accumulated = []

		for (dayStr of dateList) {

			const dailyCryptoToCryptoAmount = cryptoToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
			const dailyCryptoToFiatAmount = cryptoToFiatAmount.find(entry => entry.date === dayStr)?.value || 0;
			const dailyFiatToCryptoAmount = fiatToCryptoAmount.find(entry => entry.date === dayStr)?.value || 0;
			prevCryptoToCryptoValue += dailyCryptoToCryptoAmount
			prevCryptoToFiatValue += dailyCryptoToFiatAmount
			prevFiatToCryptoValue += dailyFiatToCryptoAmount
			prevTotalValue += dailyCryptoToCryptoAmount + dailyCryptoToFiatAmount + dailyFiatToCryptoAmount


			accumulated.push({ date: dayStr, value: parseFloat(prevTotalValue.toFixed(2)), category: "Total Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToCryptoValue.toFixed(2)), category: "Wallet Transfer Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevFiatToCryptoValue.toFixed(2)), category: "Fiat Deposit Volume" })
			accumulated.push({ date: dayStr, value: parseFloat(prevCryptoToFiatValue.toFixed(2)), category: "Stablecoin Withdraw Volume" })
		}

		return res.status(200).json({ history: accumulated, periodStartDate: startDate, periodEndDate: endDate });

	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getTotalTransactionAmountHistory", null, error.message, null, profileId)
		return res.status(500).json({ error: 'Internal server error' });
	}

}

exports.getCurrentBillingInformation = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, startDate, endDate } = req.query
	try {
		// get user billing period
		const { data: billingInformation, error: billingInformationError } = await supabase
			.from("billing_information")
			.select("next_billing_period_start, next_billing_period_end")
			.eq("profile_id", profileId)
			.single()
		if (billingInformationError) throw billingInformationError
		const billingInfo = await calculateCustomerMonthlyBill(profileId, billingInformation.next_billing_period_start, billingInformation.next_billing_period_end)

		return res.status(200).json(billingInfo)
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getCurrentBillingInformation", null, error.message, null, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}

}

exports.getInvoiceHistory = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId, createdAfter, createdBefore, limit } = req.query
	try {
		const invoiceCreatedAfter = createdAfter || new Date("1900-01-01").toISOString()
		const invoiceCreatedBefore = createdBefore || new Date("2200-01-01").toISOString()
		const invoiceLimit = limit || 10
		const { data, error } = await supabaseCall(() => supabase
			.from("billing_history")
			.select("id, hifi_billing_id,created_at, final_billable_fee_amount, billing_documentation_url, hosted_billing_page_url, status, billing_email, billable_payout_fee, billable_deposit_fee, billable_active_virtual_account_fee, billing_due_date")
			.eq("profile_id", profileId)
			.neq("status", "CREATED")
			.lt("created_at", invoiceCreatedBefore)
			.gt("created_at", invoiceCreatedAfter)
			.order("created_at", { ascending: false })
			.limit(invoiceLimit))

		const records = data.map((d) => {
			return {
				id: d.id,
				hifiBillingId: d.hifi_billing_id,
				createdAt: d.created_at,
				paymentAmount: d.final_billable_fee_amount,
				payoutFee: d.billable_payout_fee,
				depositFee: d.billable_deposit_fee,
				virtualAccountFee: d.billable_active_virtual_account_fee,
				status: d.status,
				billingEmail: d.billing_email,
				billingDocumentationUrl: d.billing_documentation_url,
				hostedBillingPageUrl: d.hosted_billing_page_url,
				billingDue: d.billing_due_date
			}
		})

		return res.status(200).json({ records: records })
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/getInvoiceHistory", null, error.message, null, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.getOrganization = async (req, res) => {
	if (req.method !== "GET") return res.status(405).json({ error: 'Method not allowed' });

	const { profileId } = req.query
	try {
		// get org config
		const { data: organization, error: organizationError } = await supabase
			.from("profiles")
			.select("organization: organization_id(prod_enabled, kyb_status, developer_user_id, prefunded_account_enabled, fee_collection_enabled, billing_enabled)")
			.eq("id", profileId)
			.single()

		if (organizationError) throw organizationError
		// get all members
		const { data: members, error: membersError } = await supabase
			.from("profiles")
			.select("id, full_name, email, organization_role, avatar_url")
			.eq("organization_id", profileId)

		if (membersError) throw membersError

		members.sort((a, b) => {
			if (a.organization_role < b.organization_role) {
				return -1;
			}
			if (a.organization_role > b.organization_role) {
				return 1;
			}
			return 0;
		});


		const result = {
			...organization,
			members
		}



		return res.status(200).json(result)

	} catch (error) {
		await createLog("dashboard/getOrganization", null, error.message, error, profileId)
		return res.status(500).json({ error: "Internal server error" })
	}

}

exports.sendInvitation = async (req, res) => {
	if (req.method !== "POST") return res.status(405).json({ error: 'Method not allowed' });

	const { originProfileId, profileId } = req.query
	const { emailAddress, role } = req.body
	try {
		// get customer profile
		const { data: profile, error: profileError } = await supabase
			.from("profiles")
			.select("organization_role, email, full_name")
			.eq("id", originProfileId)
			.single()
		if (profileError) throw profileError
		if (profile.organization_role != "ADMIN") return res.status(401).json({ error: "Only ADMIN is allow to send invitation" })

		// check if email is already in profile table
		const { data: profileToInvite, error: profileToInviteError } = await supabase
			.from("profiles")
			.select("id")
			.eq("email", emailAddress)
			.maybeSingle()

		if (profileToInviteError) throw profileToInviteError

		// insert Invitation record
		let expiredAt = new Date();
		expiredAt.setTime(expiredAt.getTime() + (24 * 60 * 60 * 1000));
		let expiredAtISO = expiredAt.toISOString();
		const { data: invitationRecord, error: invitationRecordError } = await supabase
			.from("organization_invitations")
			.insert({
				expired_at: expiredAtISO,
				organization_id: profileId,
				recipient_email: emailAddress,
				role: role,
				sender: profile.full_name || profile.email
			})
			.select("session_token")
			.single()
		if (invitationRecordError) throw invitationRecordError

		// generate magic link
		const { data, error } = await supabase.auth.admin.generateLink({
			type: 'magiclink',
			email: emailAddress,
			options: {
				redirectTo: `${process.env.DASHBOARD_URL}/auth/invitation?sessionToken=${invitationRecord.session_token}`
			}
		})
		if (error) throw error
		const link = data.properties.action_link

		// send Invitation email
		const sender = profile.full_name || profile.email
		const form = new FormData();
		form.append('from', `HIFI Developer Dashboard <noreply@${process.env.MAILGUN_DOMAIN}>`);
		form.append('to', emailAddress);
		form.append('template', 'organization invitation');
		form.append('v:redirect_to', link);
		form.append('v:from_email', `${sender}`);

		const authHeader = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
		const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
			method: 'POST',
			headers: {
				'Authorization': authHeader
			},
			body: form
		});
		const responseBody = await response.json()
		if (!response.ok) {
			await createLog("ashboard/sendInvitation", null, "Failed to send invitaion emailvia mailgun", responseBody, originProfileId)
			return res.status(500).json({ error: "Internal server error" })
		}

		return res.status(200).json({ message: "Invitation sent" })
	} catch (error) {
		await createLog("dashboard/sendInvitation", null, error.message, error, originProfileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.acceptInvitation = async (req, res) => {
	if (req.method !== "POST") return res.status(405).json({ error: 'Method not allowed' });

	const { sessionToken } = req.body
	const { originProfileId } = req.query

	try {
		// get recipient profile info
		const { data: profile, error: profileError } = await supabase
			.from("profiles")
			.select("email")
			.eq("id", originProfileId)
			.single()
		if (profileError) throw profileError

		// get invitation record
		const { data: invitationRecord, error: invitationRecordError } = await supabase
			.from("organization_invitations")
			.select("*")
			.eq("session_token", sessionToken)
			.eq("recipient_email", profile.email)
			.maybeSingle()
		if (invitationRecordError) throw invitationRecordError
		if (!invitationRecord || !invitationRecord.valid) return res.status(403).json({ error: "Invalid invitation" })

		if (new Date() > new Date(invitationRecord.expired_at)) return res.status(403).json({ error: "Expired invitation" })

		// update profile
		const { data: updatedProfile, error: updatedProfileError } = await supabase
			.from("profiles")
			.update({
				organization_id: invitationRecord.organization_id,
				organization_role: invitationRecord.role
			})
			.eq("id", originProfileId)

		if (updatedProfileError) throw updatedProfileError

		// update invitation
		const { data: updateInvitationRecord, error: updateInvitationRecordError } = await supabase
			.from("organization_invitations")
			.update({
				valid: false
			})
			.eq("id", invitationRecord.id)
		if (updateInvitationRecordError) throw updateInvitationRecordError


		return res.status(200).json({ message: "Success" })
	} catch (error) {
		await createLog("dashboard/utils/acceptInvitation", null, error.message, error, originProfileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.editOrganizationMember = async (req, res) => {
	if (req.method !== "PUT") return res.status(405).json({ error: 'Method not allowed' });

	const { originProfileId, profileId } = req.query
	const { newRole, isDelete, userId } = req.body

	try {
		if (isDelete) {
			// remove profile form organization
			const { data: updatedProfile, error: updatedProfileError } = await supabase
				.from("profiles")
				.update({
					organization_id: userId,
					organization_role: "ADMIN"
				})
				.eq("id", userId)
				.eq("organization_id", profileId)

			if (updatedProfileError) throw updatedProfileError
			return res.status(200).json({ message: "Remove member success" })
		}

		// update role
		const { data: updatedProfile, error: updatedProfileError } = await supabase
			.from("profiles")
			.update({
				organization_role: newRole
			})
			.eq("id", userId)
			.eq("organization_id", profileId)

		if (updatedProfileError) throw updatedProfileError
		return res.status(200).json({ message: "update member success" })
	} catch (error) {
		await createLog("dashboard/utils/editOrganizationMember", null, error.message, error, originProfileId)
		return res.status(500).json({ error: "Internal server error" })
	}
}

exports.tutorialCheckList = async (req, res) => {
	if (req.method !== "POST") return res.status(405).json({ error: 'Method not allowed' });
	const { profileId } = req.query
	const { checkList } = req.body

	try {
		const newCheckList = await tutorialCheckList(profileId, checkList)
		return res.status(200).json({ checkList: newCheckList })
	} catch (error) {
		console.error(error)
		await createLog("dashboard/utils/tutorialCheckList", null, error.message, error, profileId)
		return res.status(500).json({ error: "Unexpected error happened" })
	}
}