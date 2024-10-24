const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const insertTransactionFeeRecord = async (record) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("fee_transactions")
        .insert(record)
        .select()
        .single());
    
    if(error) throw error;
    return data;

}

const updateTransactionFeeRecord = async (transactionId, update) => {
 
    const { data, error } = await supabaseCall(() => supabase
        .from("fee_transactions")
        .update({updated_at: new Date().toISOString(), ...update})
        .eq("transaction_id", transactionId)
        .select()
        .maybeSingle());
    
    if(error) throw error;
    return data;

}

const getTransactionFeeRecord = async (transactionId) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("fee_transactions")
        .select()
        .eq("transaction_id", transactionId)
        .single());
    
    if(error) throw error;
    return data;

}

const getOptimisticAvailableBalance = async (profileId) => {

    const { data, error } = await supabase.rpc('get_optimistic_available_balance', { profile_id_arg: profileId });
    if(error){
        console.log(error)
        throw error;
    }

    return data;

}

module.exports = {
    insertTransactionFeeRecord,
    updateTransactionFeeRecord,
    getTransactionFeeRecord,
    getOptimisticAvailableBalance
}