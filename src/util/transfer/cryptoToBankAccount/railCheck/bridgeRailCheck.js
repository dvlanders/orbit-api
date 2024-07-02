const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const bridgeRailCheck = async (destinationUserId, externalAccountId, sourceCurrency, destinationCurrency, chain) => {

	// check if the destination user own the external account
	let { data: bridgeExternalAccount, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
		.from('bridge_external_accounts')
		.select('id')
		.eq("user_id", destinationUserId)
		.eq("id", externalAccountId)
		.maybeSingle())


	if (bridgeExternalAccountError) throw bridgeExternalAccountError
	if (!bridgeExternalAccount) return { isExternalAccountExist: false, liquidationAddress: null, liquidationAddressId: null }

	// check if liquidationAddress is created
	const { data: liquidationAddressData, error: liquidationAddressError } = await supabaseCall(() => supabase
		.from('bridge_liquidation_addresses')
		.select('id, address, currency, destination_currency, chain, liquidation_address_id, bridge_external_accounts (bridge_external_account_id)')
		.eq('external_account_id', externalAccountId)
		.eq("currency", sourceCurrency)
		.eq('destination_currency', destinationCurrency)
		.eq('chain', chainToVirtualAccountPaymentRail[chain])
		.maybeSingle())

	if (liquidationAddressError) throw liquidationAddressError
	if (!liquidationAddressData) return { isExternalAccountExist: false, liquidationAddress: null, liquidationAddressId: null }
	return { isExternalAccountExist: true, liquidationAddress: liquidationAddressData.address, liquidationAddressId: liquidationAddressData.liquidation_address_id, bridgeExternalAccountId: liquidationAddressData.bridge_external_accounts.bridge_external_account_id }

}

module.exports = bridgeRailCheck