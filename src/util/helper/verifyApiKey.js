const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

exports.verifyApiKey = async(apiKeyId) => {

    let { data: keyInfo, error } = await supabaseCall(() => supabase
        .from('api_keys')
        .select('active, expired_at, profile_id, profiles!inner(email)')
        .eq("id", apiKeyId)
        .maybeSingle()
    )

    if (error) throw error
    if (!keyInfo) return null
    // inactive account
    if (!keyInfo.active) return null
    // expired account
    if (new Date() > new Date(keyInfo.expired_at)) return null
    // no profile id found
    if (!keyInfo.profile_id) throw new Error(`No profile id found for api key id ${apiKeyId}`)

    return keyInfo
        
}