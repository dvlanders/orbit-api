const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.updateFeeRecord = async(id, requestInfo) => {

    const { data, error } = await supabaseCall(() => supabase
    .from('developer_fees')
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