const { sendMessage } = require("../../../../../webhooks/sendWebhookMessage")
const { webhookEventActionType, webhookEventType } = require("../../../../../webhooks/webhookConfig")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const FiatToCryptoSupportedPairFetchFunctionsCheck = require("./fiatToCryptoSupportedPairFetchFunctions")

const sendSimulatedMessage = async (receipt, profileId) => {
    console.log(receipt.transferDetails.status)
    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.FIAT_TO_CRYPTO"],
        data: receipt
    }
    await sendMessage(profileId, message)
}

const simulateSandboxFiatToCryptoTransactionStatus = async (record) => {
    // get profileId
    let { data: user, error: userError } = await supabaseCall(() => supabase
    .from('users')
    .select('profile_id')
    .eq("id", record.user_id)
    .single()
    )

    const fetchFunc = FiatToCryptoSupportedPairFetchFunctionsCheck(record.crypto_provider, record.fiat_provider)
	const receipt = await fetchFunc(record.id, user.profile_id)

    // simulate success checkbook submitted onchain
    receipt.transferDetails.status = "FIAT_SUBMITTED"
    await sendSimulatedMessage(receipt, user.profile_id)
    // simulate success bastion transfer
    receipt.transferDetails.status = "FIAT_PROCESSED"
    await sendSimulatedMessage(receipt, user.profile_id)
    // simulate success fiat in process
    receipt.transferDetails.status = "CRYPTO_SUBMITTED"
    await sendSimulatedMessage(receipt, user.profile_id)
}

module.exports = {
	simulateSandboxFiatToCryptoTransactionStatus
}