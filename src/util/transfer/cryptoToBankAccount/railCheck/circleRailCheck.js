const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const circleRailCheck = async (sourceUserId, externalAccountId, sourceCurrency, destinationCurrency, chain) => {


	// check if the destination user own the external account
	let { data: circleAccount, error: circleAccountError } = await supabaseCall(() => supabase
		.from('circle_accounts')
		.select('id')
		.eq("user_id", sourceUserId)
		.eq("id", externalAccountId)
		.maybeSingle())

	if (circleAccountError) throw circleAccountError
	if (!circleAccount) return { isExternalAccountExist: false, liquidationAddress: null, liquidationAddressId: null }


	return { circleAccountExists: true }

}

module.exports = circleRailCheck