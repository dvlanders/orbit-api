const { virtualAccountPaymentRailToChain } = require("../../src/util/bridge/utils")
const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfog")


const notifyFiatToCryptoTransfer = async(record) => {

    // get profileId
    let { data: user, error: userError } = await supabaseCall(() => supabase
    .from('users')
    .select('profile_id')
    .eq("id", record.user_id)
    .single()
    )

    if (userError) {
        createLog("webhook/notifyCryptoToFiatTransfer", record.sender_user_id, userError.message)
        return
    }


    // get rail information
    let { data: bridgeVirtualAccount, error: bridgeVirtualAccountError } = await supabaseCall(() => supabase
        .from('bridge_virtual_accounts')
        .select('destination_payment_rail, source_currency, destination_currency')
        .eq("virtual_account_id", record.bridge_virtual_account_id)
        .single())

    if (bridgeVirtualAccountError) throw bridgeVirtualAccountError

    // get source plaid account information

    let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
        .from('checkbook_accounts')
        .select('id')
        .eq("checkbook_id", record.plaid_checkbook_id)
        .single())

    if (bridgeExternalAccountError) throw bridgeExternalAccountError
        
    const receipt = {
        transferType: transferType.FIAT_TO_CRYPTO,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            destinationUserId: record.destination_user_id,
            chain: virtualAccountPaymentRailToChain[bridgeVirtualAccount.destination_payment_rail],
            sourceCurrency: bridgeVirtualAccount.source_currency,
            amount: record.amount,
            destinationCurrency: bridgeVirtualAccount.destination_currency,
            sourceAccountId: bridgeExternalAccount.id,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            status: record.status,
        }
    }


    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.FIAT_TO_CRYPTO"],
        data: receipt
    }

    await sendMessage(user.profile_id, message)
    console.log("message sent")

}

module.exports = notifyFiatToCryptoTransfer