const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { convertKeysToCamelCase } = require("../../utils/object");

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

const getTotalBalanceTopups = async (profileId, fromDate, toDate) => {

    const { data, error } = await supabase.rpc('get_balance_topup_total', { profile_id_arg: profileId, from_arg: fromDate, to_arg: toDate});
    if(error){
        console.log(error)
        throw error;
    }

    return data;

}

const getBalanceTopupsHistory = async (profileId, fromDate, toDate, limit) => {

    const { data, error } = await supabase
        .from("balance_topups")
        .select("id, created_at, amount, transaction_hash")
        .eq("profile_id", profileId)
        .gt("created_at", fromDate)
        .lt("created_at", toDate)
        .order("created_at", {ascending: false})
        .limit(limit)

    if(error){
        console.log(error)
        throw error;
    }

    return convertKeysToCamelCase(data);
}


module.exports = {
    addBaseBalanceRecord,
    deductBalance,
    topupBalance,
    isBalanceChangeApplied,
    getBalance,
    getTotalBalanceTopups,
    getBalanceTopupsHistory
}