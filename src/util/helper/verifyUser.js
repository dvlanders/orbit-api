const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

exports.verifyUser = async(userId, profileId) => {

    let { data: user, error } = await supabaseCall(() => supabase
        .from('users')
        .select('*')
        .eq("id", userId)
        .eq("profile_id", profileId)
        .maybeSingle()
    )

    if (error) throw error
    if (!user) return false

    return true
        
}