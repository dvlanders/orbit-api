let supabase = require("../../supabaseClient");
const supabaseSandbox = require("../../sandboxSupabaseClient");

const deleteWebhookUrl = async(profileId, env) => {
    let supabaseClient
    if (env == "sandbox"){
        supabaseClient = supabaseSandbox
    }else if (env == "production"){
        supabaseClient = supabase
    }else{
        throw new Error("Invalid env")
    }

    const { data, error } = await supabaseClient
    .from('webhook_urls')
    .delete()
    .eq("profile_id", profileId)
    .select()
    .maybeSingle()
    if (error) throw error
    if (!data) throw new Error("No webhook found")

    
}

module.exports = deleteWebhookUrl
