const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

exports.updateContractActionRecord = async(recordId, toUpdate) => {
    
    const { data, error } = await supabaseCall(() => supabase
    .from('contract_actions')
    .update(toUpdate)
    .eq("id", recordId)
    .select("*")
    .single())

    if (error) throw error
    return data
        
}