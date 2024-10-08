const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const insertBridgeCustomerRecord = async (toInsert) => {
    const { data, error } = await supabaseCall(() => supabase
        .from('bridge_customers')
        .insert(toInsert)
        .select()
        .single());
    if (error) throw error;
    return data;
}

module.exports = {
    insertBridgeCustomerRecord
}