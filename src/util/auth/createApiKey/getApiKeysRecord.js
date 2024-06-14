const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.getApiKeysRecord = async(profileiId) => {
    const { data: apiKeysDetails, error: apiKeysDetailsError } = await supabaseCall(() => supabase
        .from('api_keys')
        .select('*')
        .eq('profile_id', profileiId))
        
    if (apiKeysDetailsError) throw apiKeysDetailsError

    return apiKeysDetails
}