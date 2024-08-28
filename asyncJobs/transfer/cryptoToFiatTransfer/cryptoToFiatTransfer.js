const { fetchAccountProviders } = require("../../../src/util/account/accountProviders/accountProvidersService")
const bastionGasCheck = require("../../../src/util/bastion/utils/gasCheck")
const { getBastionWallet } = require("../../../src/util/bastion/utils/getBastionWallet")
const { currencyDecimal } = require("../../../src/util/common/blockchain")
const createLog = require("../../../src/util/logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../src/util/smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../src/util/smartContract/approve/getApproveAmount")
const supabase = require("../../../src/util/supabaseClient")
const { transferToBridgeLiquidationAddress } = require("../../../src/util/transfer/cryptoToBankAccount/transfer/transferToBridgeLiquidationAddress")
const { executeAsyncTransferCryptoToFiat } = require("../../../src/util/transfer/cryptoToBankAccount/transfer/transferToBridgeLiquidationAddressV2")
const CryptoToBankSupportedPairCheck = require("../../../src/util/transfer/cryptoToBankAccount/utils/cryptoToBankSupportedPairFunctions")
const { toUnitsString } = require("../../../src/util/transfer/cryptoToCrypto/utils/toUnits")
const { JobError, JobErrorType } = require("../../error")

exports.cryptoToFiatTransferAsync = async (config) => {
	console.log("cryptoToFiatTransferAsync")
	try {
		// fetch record
		const { data: record, error } = await supabase
			.from("offramp_transactions")
			.select("*")
			.eq("id", config.recordId)
			.single()

		if (error) throw error

		// gas check
		const { needFund, fundSubmitted } = await bastionGasCheck(record.user_id, record.chain, record.transfer_from_wallet_type)
		if (needFund) {
			throw new JobError(JobErrorType.RESCHEDULE, "wallet gas not enough", null, null, true, false)
		}

		// check allowance if not enough perform a token approve job and reschedule transfer
		if (record.developer_fee_id) {
			const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.source_currency])
			const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][record.chain]
			const { walletAddress: sourceWalletAddress } = await getBastionWallet(record.user_id, record.chain)
			const allowance = await getTokenAllowance(record.chain, record.source_currency, sourceWalletAddress, paymentProcessorContractAddress)
			if (allowance < BigInt(unitsAmount)) {
				await approveMaxTokenToPaymentProcessor(record.user_id, record.chain, record.source_currency)
				throw new JobError(JobErrorType.RESCHEDULE, "Token approve amount not enough", null, null, true, false)
			}
		}

		// get account info
		const accountInfo = await fetchAccountProviders(record.destination_account_id, config.profileId)
		if (!accountInfo || !accountInfo.account_id) return res.status(400).json({ error: `destinationAccountId not exist` });
		if (accountInfo.rail_type != "offramp") return res.status(400).json({ error: `destinationAccountId is not a offramp bank account` });
		const paymentRail = accountInfo.payment_rail


		//check is source-destination pair supported
		const funcs = CryptoToBankSupportedPairCheck(paymentRail, record.source_currency, record.destination_currency)
		if (!funcs) throw new Error(`${paymentRail}: ${record.source_currency} to ${record.destination_currency} is not a supported rail`)
		const { asyncTransferExecuteFunc } = funcs
		if (!asyncTransferExecuteFunc) throw new Error(`${paymentRail}: ${record.source_currency} to ${record.destination_currency} does not support async transfer`)

		const transferConfig = { profileId: config.profileId, recordId: record.id }

		await asyncTransferExecuteFunc(transferConfig)

	} catch (error) {
		console.error(error)
		if (error instanceof JobError) throw error
		await createLog("job/transfer/cryptoToFiatTransferAsync", config.userId, error.message, error)
		// don't reSchedule
		throw new JobError(JobErrorType.RESCHEDULE, error.message, null, error.message, false)
	}

}

