const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");


exports.updateRequestRecord = async(id, requestInfo) => {

    const { data, error } = await supabaseCall(() => supabase
    .from('onramp_transactions')
    .update({ 
        ...requestInfo,
        updated_at: new Date().toISOString(),
    },)
    .eq('id', id)
    .select("*")
    .single()
    )

    if (error) throw error
    return data
        
}