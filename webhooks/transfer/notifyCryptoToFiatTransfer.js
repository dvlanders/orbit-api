const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")
const { supabaseCall } = require("../../src/util/supabaseWithRetry")
const { transferType } = require("../../src/util/transfer/utils/transfer")
const { sendMessage } = require("../sendWebhookMessage")
const { webhookEventType, webhookEventActionType } = require("../webhookConfog")

const notifyCryptoToFiatTransfer = async(record) => {

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
    let { data: bridgeLiquidationAddress, error: bridgeLiquidationAddressError } = await supabaseCall(() => supabase
    .from('bridge_liquidation_addresses')
    .select('chain, currency, destination_currency')
    .eq("liquidation_address_id", record.to_bridge_liquidation_address_id)
    .single())

    if (bridgeLiquidationAddressError) throw bridgeLiquidationAddressError

    // get external account information

    let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
        .from('bridge_external_accounts')
        .select('id')
        .eq("bridge_external_account_id", record.to_bridge_external_account_id)
        .single())

    if (bridgeExternalAccountError) throw bridgeExternalAccountError

    const receipt = {
        transferType: transferType.CRYPTO_TO_FIAT,
        transferDetails: {
            id: record.id,
            requestId: record.request_id,
            sourceUserId: record.user_id,
            destinationUserId: record.destination_user_id,
            chain: bridgeLiquidationAddress.chain,
            sourceCurrency: bridgeLiquidationAddress.currency,
            amount: record.amount,
            destinationCurrency: bridgeLiquidationAddress.destination_currency,
            destinationAccountId: bridgeExternalAccount.id,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            status: record.transaction_status,
            contractAddress: record.contract_address,
        }
    }

    const message = {
        eventAction: webhookEventActionType.UPDATE,
        eventType: webhookEventType["TRANSFER.CRYPTO_TO_FIAT"],
        data: receipt
    }

    await sendMessage(user.profile_id, message)
    console.log("message sent")

}

module.exports = notifyCryptoToFiatTransfer