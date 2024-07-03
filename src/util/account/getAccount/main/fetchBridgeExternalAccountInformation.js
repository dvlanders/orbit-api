const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const filledInfo = (bridgeExternalAccountData) => {
	return {
		accountId: bridgeExternalAccountData.id,
		userId: bridgeExternalAccountData.user_id,
		createdAt: bridgeExternalAccountData.created_at,
		currency: bridgeExternalAccountData.currency,
		bankName: bridgeExternalAccountData.bank_name,
		accountOwnerName: bridgeExternalAccountData.account_owner_name,
		accountOwnerType: bridgeExternalAccountData.account_owner_type,
		accountType: bridgeExternalAccountData.account_type,
		beneficiaryStreetLine1: bridgeExternalAccountData.beneficiary_street_line_1,
		beneficiaryStreetLine2: bridgeExternalAccountData.beneficiary_street_line_2,
		beneficiaryCity: bridgeExternalAccountData.beneficiary_city,
		beneficiaryState: bridgeExternalAccountData.beneficiary_state,
		beneficiaryPostalCode: bridgeExternalAccountData.beneficiary_postal_code,
		beneficiaryCountry: bridgeExternalAccountData.beneficiary_country,
		iban: bridgeExternalAccountData.iban,
		businessIdentifierCode: bridgeExternalAccountData.business_identifier_code,
		bankCountry: bridgeExternalAccountData.bank_country,
		accountNumber: bridgeExternalAccountData.account_number,
		routingNumber: bridgeExternalAccountData.routing_number,
	}
}


const fetchBridgeExternalAccountInformation = async (currency, accountId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
	let allBanksInfo
	let bankInfo
	if (!accountId){
		let { data: bridgeExternalAccountData, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
		.from('bridge_external_accounts')
		.select('id, created_at, currency, bank_name, account_owner_name, account_owner_type, account_type, beneficiary_street_line_1, beneficiary_street_line_2, beneficiary_city, beneficiary_state, beneficiary_postal_code, beneficiary_country, iban, business_identifier_code, bank_country, account_number, routing_number, user_id')
		.eq('currency', currency)
		.lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)
		)
		if (bridgeExternalAccountError) throw bridgeExternalAccountError
		allBanksInfo = bridgeExternalAccountData
	}else{
		let { data: bridgeExternalAccountData, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
			.from('bridge_external_accounts')
			.select('id, created_at, currency, bank_name, account_owner_name, account_owner_type, account_type, beneficiary_street_line_1, beneficiary_street_line_2, beneficiary_city, beneficiary_state, beneficiary_postal_code, beneficiary_country, iban, business_identifier_code, bank_country, account_number, routing_number, user_id')
			.eq('id', accountId)
			.eq('currency', currency)
			.maybeSingle()
		)
		if (bridgeExternalAccountError) throw bridgeExternalAccountError
		bankInfo = bridgeExternalAccountData
	}

	if (accountId && !bankInfo) return null
	if (bankInfo){
		return filledInfo(bankInfo)
	}else if (allBanksInfo){
		return {
			count: allBanksInfo.length,
			banks: allBanksInfo.map((bank) => filledInfo(bank))
		}
	}

	return null

}

module.exports = {
	fetchBridgeExternalAccountInformation,
}