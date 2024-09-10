const { sendMessage } = require("../../../../../webhooks/sendWebhookMessage")
const notifyCryptoToFiatTransfer = require("../../../../../webhooks/transfer/notifyCryptoToFiatTransfer")
const { webhookEventActionType, webhookEventType } = require("../../../../../webhooks/webhookConfig")
const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { FetchCryptoToBankSupportedPairCheck } = require("./cryptoToBankSupportedPairFetchFunctions")
const { updateRequestRecord } = require("./updateRequestRecord")

const defaultStatusFlow = [
    "SUBMITTED_ONCHAIN",
    "COMPLETED_ONCHAIN",
    "IN_PROGRESS_FIAT",
    "INITIATED_FIAT"
]

const sendSimulatedMessage = async (receipt, profileId) => {
    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.CRYPTO_TO_FIAT"],
        data: receipt
    }
    await sendMessage(profileId, message)
}

const simulateSandboxCryptoToFiatTransactionStatus = async (record, flow = defaultStatusFlow) => {
    // get profileId
    let { data: user, error: userError } = await supabaseCall(() => supabase
    .from('users')
    .select('profile_id')
    .eq("id", record.user_id)
    .single()
    )

    const fetchFunc = FetchCryptoToBankSupportedPairCheck(record.crypto_provider, record.fiat_provider)
	const receipt = await fetchFunc(record.id, user.profile_id)

    for (const status of flow) {
        receipt.transferDetails.status = status
        await sendSimulatedMessage(receipt, user.profile_id)
    }
}

module.exports = {
	simulateSandboxCryptoToFiatTransactionStatus
}