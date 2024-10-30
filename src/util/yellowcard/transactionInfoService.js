const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");


const insertYellowCardTransactionInfo = async (transactionInfo) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("yellowcard_transactions")
                .insert(transactionInfo)
                .select()
                .single());

    if (error) {
        throw error;
    }

    return data;

}

const getYellowCardTransactionInfo = async (id) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("yellowcard_transactions")
                .select()
                .eq("id", id)
                .single());

    if (error) {
        throw error;
    }

    return data;

}

const updateYellowCardTransactionInfo = async (id, transactionInfo) => {

    const { data, error } = await supabaseCall(() =>
        supabase.from("yellowcard_transactions")
                .update(transactionInfo)
                .eq("id", id)
                .select()
                .single());

    if (error) {
        throw error;
    }

    return data;

}


module.exports = {
    insertYellowCardTransactionInfo,
    getYellowCardTransactionInfo,
    updateYellowCardTransactionInfo
}