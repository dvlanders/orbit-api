const supabase = require("../../../supabaseClient");

exports.updateRequestRecord = async(id, record) => {
    const {data, error} = await supabase
        .from("offramp_transactions")
        .update(record)
        .eq("id", id)
        .select("*")
        .single()
    
    if (error) throw error
    return data
}