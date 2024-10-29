const supabase = require("../../supabaseClient");
const supabaseSandbox = require("../../sandboxSupabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.insertApiKeyRecord = async (info, env) => {
	const client = env === "sandbox" ? supabaseSandbox : supabase;

	const { data: apiKeysDetails, error: apiKeysDetailsError } = await supabaseCall(() => client
		.from('api_keys')
		.insert({
			id: info.id,
			expired_at: info.expiredAt,
			user_custom_name: info.userCustomName,
			profile_id: info.profileId,
			zuplo_api_key_id: info.zuploApiKeyId,
			zuplo_customer_id: info.zuploCustomerId,
			is_dashboard_api_key: info.isDashboardKey
		})
		.select("*")
		.single()
	);

	if (apiKeysDetailsError) throw apiKeysDetailsError;
	return apiKeysDetails;
}
