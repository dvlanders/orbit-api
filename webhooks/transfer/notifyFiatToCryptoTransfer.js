const { virtualAccountPaymentRailToChain } = require("../../src/util/bridge/utils")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("../../src/util/transfer/fiatToCrypto/utils/fiatToCryptoSupportedPairFetchFunctions")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfig")


const notifyFiatToCryptoTransfer = async (record) => {

	// get profileId
	let { data: user, error: userError } = await supabaseCall(() => supabase
		.from('users')
		.select('profile_id')
		.eq("id", record.user_id)
		.single()
	)

	if (userError) {
		await createLog("webhook/notifyCryptoToFiatTransfer", record.user_id, userError.message)
		return
	}

	const fetchFunc = FiatToCryptoSupportedPairFetchFunctionsCheck(record.crypto_provider, record.fiat_provider)
	const receipt = await fetchFunc(record.id, user.profile_id)


	const message = {
		eventAction: webhookEventActionType.UPDATE,
		eventType: webhookEventType["TRANSFER.FIAT_TO_CRYPTO"],
		data: receipt
	}

	await sendMessage(user.profile_id, message)
	console.log("message sent")

}

module.exports = notifyFiatToCryptoTransfer