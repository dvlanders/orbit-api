const { sendMessage } = require("../../../../../webhooks/sendWebhookMessage")
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer")
const { webhookEventActionType, webhookEventType } = require("../../../../../webhooks/webhookConfig")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { FetchCryptoToBankSupportedPairCheck } = require("./cryptoToBankSupportedPairFetchFunctions")
const { updateRequestRecord } = require("./updateRequestRecord")

const sendSimulatedMessage = async (receipt, profileId) => {
    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.CRYPTO_TO_FIAT"],
        data: receipt
    }
    await sendMessage(profileId, message)
}

const simulateSandboxCryptoToFiatTransactionStatus = async (record) => {
    // get profileId
    let { data: user, error: userError } = await supabaseCall(() => supabase
    .from('users')
    .select('profile_id')
    .eq("id", record.user_id)
    .single()
    )

    const fetchFunc = FetchCryptoToBankSupportedPairCheck(record.crypto_provider, record.fiat_provider)
	const receipt = await fetchFunc(record.id, user.profile_id)

    // simulate success bastion submitted onchain
    receipt.transferDetails.status = "SUBMITTED_ONCHAIN"
    await sendSimulatedMessage(receipt, user.profile_id)
    // simulate success bastion transfer
    receipt.transferDetails.status = "COMPLETED_ONCHAIN"
    await sendSimulatedMessage(receipt, user.profile_id)
    // simulate success fiat in process
    receipt.transferDetails.status = "IN_PROGRESS_FIAT"
    await sendSimulatedMessage(receipt, user.profile_id)
    // simulate success fiat submitted
    receipt.transferDetails.status = "INITIATED_FIAT"
    await sendSimulatedMessage(receipt, user.profile_id)
}

module.exports = {
	simulateSandboxCryptoToFiatTransactionStatus
}