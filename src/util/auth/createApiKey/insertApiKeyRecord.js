const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.insertApiKeyRecord = async(info) => {
    const { data: apiKeysDetails, error: apiKeysDetailsError } = await supabaseCall(() => supabase
        .from('api_keys')
        .insert({
            id: info.id,
            expired_at: info.expiredAt,
            user_custom_name: info.userCustomName,
            profile_id: info.profileId,
            zuplo_api_key_id: info.zuploApiKeyId,
            zuplo_customer_id: info.zuploCustomerId,
        })
        .select("*")
        .single()
    )

    if (apiKeysDetailsError) throw apiKeysDetailsError
    return apiKeysDetails
}