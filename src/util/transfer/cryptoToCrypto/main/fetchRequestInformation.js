const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchRequestInfortmaion = async(requestId) => {
    let { data: request, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .select('*')
    .eq("request_id", requestId)
    .maybeSingle())

    if (error) throw error
    return request
}

module.exports = {
    fetchRequestInfortmaion
}