const { chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const { CreateFiatToCryptoTransferError, CreateFiatToCryptoTransferErrorType } = require("../utils/utils");

const bridgePlaidRailCheck = async(CheckbookAccountIdForPlaid, sourceCurrency, destinationCurrency, chain, sourceUserId, destinationUserId) => {
    // get checkbook account that bind the plaid
    // the account is belong to
    const {data: checkbookAccountForPlaid, error: checkbookAccountForPlaidError} = await supabaseCall(() => supabase
    .from("checkbook_accounts")
    .select("checkbook_id, account_type")
    .eq("id", CheckbookAccountIdForPlaid)
    .eq("user_id", sourceUserId)
    .eq("connected_account_type", "PLAID")
    .maybeSingle())

    if (checkbookAccountForPlaidError) {
        await createLog("transfer/utils/bridgePlaidRailCheck", sourceUserId, checkbookAccountForPlaidError.message, checkbookAccountForPlaidError)
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, checkbookAccountForPlaidError.message)
    }
    // client provide the wrong id
    if (!checkbookAccountForPlaid) {
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.CLIENT_ERROR, "No resource found for provided sourceAccountId")
    }

    // get bridge virtual account that has the corresponding rail
    let { data: bridgeVirtualAccount, error: bridgeVirtualAccountError } = await supabaseCall(() => supabase
        .from('bridge_virtual_accounts')
        .select('id, virtual_account_id, deposit_institutions_bank_routing_number, deposit_institutions_bank_account_number, destination_wallet_address')
        .eq("user_id", destinationUserId)
        .eq("source_currency", sourceCurrency)
        .eq("destination_currency", destinationCurrency)
        .eq("destination_payment_rail", chainToVirtualAccountPaymentRail[chain])
        .maybeSingle())
    
    if (bridgeVirtualAccountError) {
        await createLog("transfer/utils/bridgePlaidRailCheck", sourceUserId, bridgeVirtualAccountError.message, bridgeVirtualAccountError)
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, bridgeVirtualAccountError.message)
    }

    // rail is not exist
    if (!bridgeVirtualAccount) throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.CLIENT_ERROR, "No virtual account found for provided sourceCurrency, destinationCurrency, chain for provided destinationUserId, please call account/activateOnRampRail to create a virtual account first")
    // check if the checkboook account is created for the virtual account
    // if not should be internal error
    const {data: checkbookAccountForBridgeVirtualAccount, error: checkbookAccountForBridgeVirtualAccountError} = await supabaseCall (() => supabase
    .from("checkbook_accounts")
    .select("*")
    .eq("bridge_virtual_account_id", bridgeVirtualAccount.virtual_account_id)
    .eq("user_id", destinationUserId)
    .eq("connected_account_type", "BRIDGE_VIRTUAL_ACCOUNT")
    .single())

    if (checkbookAccountForBridgeVirtualAccountError) {
        await createLog("transfer/utils/bridgePlaidRailCheck", sourceUserId, checkbookAccountForBridgeVirtualAccountError.message, checkbookAccountForBridgeVirtualAccountError)
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, checkbookAccountForBridgeVirtualAccountError.message)
    }

    // get api keys and secret of sourceUser
    let { data: checkbookUser, error: checkbookUserError } = await supabaseCall (() => supabase
        .from('checkbook_users')
        .select('api_key, api_secret')
        .eq("user_id", sourceUserId)
        .eq("type", "SOURCE")
        .single())

    if (checkbookUserError) {
        await createLog("transfer/utils/bridgePlaidRailCheck", sourceUserId, checkbookUserError.message, checkbookUserError)
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, checkbookUserError.message)
    }
    
    const { data: bridgeUser, error: bridgeUserError } = await supabaseCall(() => supabase
        .from("bridge_customers")
        .select("bridge_id")
        .eq("user_id", destinationUserId)
        .single())

    if (bridgeUserError) {
        await createLog("transfer/utils/bridgePlaidRailCheck", sourceUserId, bridgeUserError.message, bridgeUserError)
        throw new CreateFiatToCryptoTransferError(CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR, bridgeUserError.message)
    }

    const transferInfo = {
        virtual_account_id: bridgeVirtualAccount.id, // destination
        bridge_virtual_account_id: bridgeVirtualAccount.virtual_account_id, // destination
        bridge_id: bridgeUser.bridge_id, // destination
        account_number: bridgeVirtualAccount.deposit_institutions_bank_account_number, // destination
        routing_number: bridgeVirtualAccount.deposit_institutions_bank_routing_number,  // destination
        plaid_checkbook_id: checkbookAccountForPlaid.checkbook_id, // source
        plaid_account_type: checkbookAccountForPlaid.account_type, //source
        api_key: checkbookUser.api_key, // source
        api_secret: checkbookUser.api_secret, // source
        recipient_checkbook_user_id:  checkbookAccountForBridgeVirtualAccount.checkbook_user_id,// FIXME could be different in the future
        destinationWalletAddress: bridgeVirtualAccount.destination_wallet_address
    }

    return transferInfo

}

module.exports = bridgePlaidRailCheck