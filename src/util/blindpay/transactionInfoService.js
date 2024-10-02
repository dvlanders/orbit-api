const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");


const insertBlinpdayTransactionInfo = async (transactionInfo) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("blindpay_transaction_info")
                .insert(transactionInfo)
                .select()
                .single());

    if (error) {
        throw error;
    }

    return data;

}

const getBlinpdayTransactionInfo = async (id) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("blindpay_transaction_info")
                .select()
                .eq("id", id)
                .single());

    if (error) {
        throw error;
    }

    return data;

}

const updateBlinpdayTransactionInfo = async (id, transactionInfo) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("blindpay_transaction_info")
                .update({updated_at: new Date().toISOString(), ...transactionInfo})
                .eq("id", id)
                .select()
                .single());

    if (error) {
        throw error;
    }

    return data;

}


module.exports = {
    insertBlinpdayTransactionInfo,
    getBlinpdayTransactionInfo,
    updateBlinpdayTransactionInfo
}