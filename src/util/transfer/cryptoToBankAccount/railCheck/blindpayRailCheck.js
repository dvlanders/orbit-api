const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const blindpayRailCheck = async (destinationUserId, externalAccountId, sourceCurrency, destinationCurrency, chain) => {

	// check if the destination user own the external account
	let { data: blindpayAccountData, error: blindpayAccountError } = await supabaseCall(() => supabase
		.from('blindpay_accounts')
		.select('blindpay_account_id')
		.eq("id", externalAccountId)
		.maybeSingle())
	if (blindpayAccountError) throw blindpayAccountError
	if (!blindpayAccountData.blindpay_account_id) return { isExternalAccountExist: false, blindpayAccountId: null }

	return { isExternalAccountExist: true, blindpayAccountId: blindpayAccountData.blindpay_account_id }

}

module.exports = blindpayRailCheck