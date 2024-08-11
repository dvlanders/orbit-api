const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const paymentRailMap = {
    "usd": "ach",
    "eur": "sepa"
}

const bridgeRailCheck = async (destinationAccountId, destinationCurrency) => {

	// check if the destination user own the external account
	let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
		.from('bridge_external_accounts')
		.select('id, bridge_external_account_id, user_id, user: user_id(bridge_customers(bridge_id))')
		.eq("currency", destinationCurrency)
		.eq("id", destinationAccountId)
		.maybeSingle())


	if (bridgeExternalAccountError) throw bridgeExternalAccountError
	if (!bridgeExternalAccount) return { isExternalAccountExist: false }
	return { isExternalAccountExist: true, destinationUserBridgeId: bridgeExternalAccount.user.bridge_customers.bridge_id, bridgeExternalAccountId: bridgeExternalAccount.bridge_external_account_id, destinationUserId: bridgeExternalAccount.user_id}

}

module.exports = bridgeRailCheck