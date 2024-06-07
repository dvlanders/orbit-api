const supabase = require("../supabaseClient")


async function createLog(source, userId, log, response) {
	const { userData, userError } = await supabase
		.from('users')
		.select('profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)')
		.eq('user_id', userId)
		.single()

	if (userError) {
		throw new Error('Failed to fetch user data for logging')
	}

	const { data, error } = await supabase
		.from('logs')
		.insert({
			source: source,
			user_id: userId,
			user_identifier: `${userData.user_kyc.legal_first_name} ${userData.user_kyc.legal_last_name} ${userData.user_kyc.business_name} ${userData.user_kyc.compliance_email}`,
			log: log,
			profile_id: userData.profile_id,
			response: response
		})
}