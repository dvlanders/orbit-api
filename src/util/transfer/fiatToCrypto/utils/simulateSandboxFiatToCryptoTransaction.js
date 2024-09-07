const { sendMessage } = require("../../../../../webhooks/sendWebhookMessage")
const { webhookEventActionType, webhookEventType } = require("../../../../../webhooks/webhookConfig")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("./fiatToCryptoSupportedPairFetchFunctions")

const defaultStatusFlow = [
    "FIAT_SUBMITTED",
    "FIAT_PROCESSED",
    "CRYPTO_SUBMITTED"
]

const sendSimulatedMessage = async (receipt, profileId) => {
    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.FIAT_TO_CRYPTO"],
        data: receipt
    }
    await sendMessage(profileId, message)
}

const simulateSandboxFiatToCryptoTransactionStatus = async (record, flow = defaultStatusFlow) => {
    // get profileId
    let { data: user, error: userError } = await supabaseCall(() => supabase
    .from('users')
    .select('profile_id')
    .eq("id", record.user_id)
    .single()
    )

    const fetchFunc = FiatToCryptoSupportedPairFetchFunctionsCheck(record.crypto_provider, record.fiat_provider)
	const receipt = await fetchFunc(record.id, user.profile_id)

    for (const status of flow){
        receipt.transferDetails.status = status
        await sendSimulatedMessage(receipt, user.profile_id)
    }
}

module.exports = {
	simulateSandboxFiatToCryptoTransactionStatus
}