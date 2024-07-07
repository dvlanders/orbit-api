const supabase = require("../../../supabaseClient")
const { supabaseCall } = require("../../../supabaseWithRetry")

const filledInfo = (checkbookAccount) => {
	return {
		accountId: checkbookAccount.id,
		userId: checkbookAccount.user_id,
		createdAt: checkbookAccount.created_at,
		accountType: checkbookAccount.account_type,
		accountNumber: checkbookAccount.account_number,
		routingNumber: checkbookAccount.routing_number,
		bankName: checkbookAccount.bank_name,
	}
}


const fetchPlaidAccountInformation = async (profileId, accountId, userId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
	let allBanksInfo
	let bankInfo
	if (!accountId){

		if (userId){
			let { data: checkbookAccount, error } = await supabaseCall(() => supabase
			.from('checkbook_accounts')
			.select('id, created_at, account_type, account_number, routing_number, bank_name, user_id')
			.eq("connected_account_type", "PLAID")
			.eq("user_id", userId)
			.lt("created_at", createdBefore)
			.gt("created_at", createdAfter)
			.order("created_at", {ascending: false})
			.limit(limit))

			if (error) throw error
			allBanksInfo = checkbookAccount
		}else{
			let { data: checkbookAccount, error } = await supabaseCall(() => supabase
			.from('checkbook_accounts')
			.select('users: user_id!inner(id, profile_id), id, created_at, account_type, account_number, routing_number, bank_name, user_id')
			.eq("connected_account_type", "PLAID")
			.eq("users.profile_id", profileId)
			.lt("created_at", createdBefore)
			.gt("created_at", createdAfter)
			.order("created_at", {ascending: false})
			.limit(limit))

			if (error) throw error
			allBanksInfo = checkbookAccount
		}
	}else{
		let { data: checkbookAccount, error } = await supabaseCall(() => supabase
		.from('checkbook_accounts')
		.select('id, created_at, account_type, account_number, routing_number, bank_name, user_id')
		.eq("id", accountId)
		.eq("connected_account_type", "PLAID")
		.maybeSingle())
		if (error) throw error
		bankInfo = checkbookAccount
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

module.exports = fetchPlaidAccountInformation