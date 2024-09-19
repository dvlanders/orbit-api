const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const getBalance = async (profileId) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("balance")
        .select("balance")
        .eq("profile_id", profileId)
        .maybeSingle());

    if(error) throw error;
    return data;

}

const addBaseBalanceRecord = async (profileId, billingInfoId) => {

    const { error } = await supabaseCall(() => supabase
    .from("balance")
    .insert({
        profile_id: profileId,
        billing_info_id: billingInfoId
    }));

    if(error) throw error;

}

const deductBalance = async (profileId, feeId, amount) => {

    console.log("deductBalance", profileId, amount)
    const { data, error } = await supabase.rpc('balance_deduct', { profile_id_arg: profileId, amount_arg: amount, fee_id_arg: feeId });
    if(error){
        console.log(error)
        throw error;
    }

    return data;
    
}

const topupBalance = async (profileId, amount, invoiceId = null, paymentIntentId = null) => {

    console.log("topupBalance", profileId, amount)
    const { data, error } = await supabase.rpc('balance_topup', { profile_id_arg: profileId, amount_arg: amount, invoice_id_arg: invoiceId, payment_intent_id_arg: paymentIntentId });
    if(error){
        console.log(error)
        throw error;
    }

    return data;
}

const isBalanceChangeApplied = async (feeId) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("balance_change_log")
        .select("id")
        .eq("fee_id", feeId)
        .maybeSingle());

    if(error) throw error;
    return !!data;
}


module.exports = {
    addBaseBalanceRecord,
    deductBalance,
    topupBalance,
    isBalanceChangeApplied,
    getBalance
}