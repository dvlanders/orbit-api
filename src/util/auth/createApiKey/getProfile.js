const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.getProfile = async(profile_id) => {
    const { data: profileDetails, error: profileDetailsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile_id)
        .single();
    
    if (profileDetailsError) throw profileDetailsError

    return profileDetails
}