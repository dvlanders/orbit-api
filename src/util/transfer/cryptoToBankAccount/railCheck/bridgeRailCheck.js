const { virtualAccountPaymentRailToChain, chainToVirtualAccountPaymentRail } = require("../../../bridge/utils");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const bridgeRailCheck = async(externalAccountId, sourceCurrency, destinationCurrency, chain) => {
    const { data: liquidationAddressData, error: liquidationAddressError } = await supabaseCall(() => supabase
		.from('bridge_liquidation_addresses')
		.select('id, address, currency, destination_currency, chain')
		.eq('external_account_id', externalAccountId)
        .eq("currency", sourceCurrency)
        .eq('destination_currency', destinationCurrency)
        .eq('chain', chainToVirtualAccountPaymentRail[chain])
		.maybeSingle())
    
    if (liquidationAddressError) throw liquidationAddressError
    if (!liquidationAddressData) return {isExternalAccountExist: false, liquidationAddress: null, liquidationAddressId: null}
    return  {isExternalAccountExist: true, liquidationAddress: liquidationAddressData.address, liquidationAddressId: liquidationAddressData.id}

}

module.exports = bridgeRailCheck