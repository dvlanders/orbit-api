const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const enableProdAccess = async(profileId) => {
    const { error } = await supabaseCall(() => supabase
        .from('profiles')
        .update({prod_enabled: true})
        .eq('id', profileId));
    
    if (error) throw error
}

const disableProdAccess = async(profileId) => {
    const { error } = await supabaseCall(() => supabase
        .from('profiles')
        .update({prod_enabled: false})
        .eq('id', profileId));
    
    if (error) throw error
}

module.exports = { enableProdAccess, disableProdAccess };