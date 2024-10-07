const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { convertKeysToCamelCase } = require("../../utils/object");

const getBalance = async (profileId) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("balance")
        .select()
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

const topupBalance = async (profileId, amount, topupId, stripe_invoice_pdf) => {

    console.log("topupBalance", profileId, amount, topupId, stripe_invoice_pdf)
    const { data, error } = await supabase.rpc('balance_topup', { profile_id_arg: profileId, amount_arg: amount, topup_id_arg: topupId, stripe_invoice_pdf_arg: stripe_invoice_pdf });
    if(error){
        console.log(error)
        throw error;
    }

    return data;
}

const getTotalBalanceTopups = async (profileId, fromDate, toDate) => {

    const { data, error } = await supabase.rpc('get_balance_topup_total', { profile_id_arg: profileId, from_arg: fromDate, to_arg: toDate});
    if(error){
        console.log(error)
        throw error;
    }

    return data;

}

const insertBalanceTopupRecord = async (record) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("balance_topups")
        .insert(record)
        .select()
        .single());

    if(error){
        throw error;
    }

    return data;

}

const updateBalanceTopupRecord = async (id, toUpdate) => {

    const { error } = await supabaseCall(() => supabase
        .from("balance_topups")
        .update({updated_at: new Date(), ...toUpdate})
        .eq("id", id));

    if(error){
        throw error;
    }
    
}

const getBalanceTopupsHistory = async (profileId, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString(), limit) => {

    const { data, error } = await supabase
        .from("balance_topups")
        .select("id, created_at, updated_at, amount, status, type, hifi_credit_id, stripe_invoice_pdf")
        .eq("profile_id", profileId)
        .gt("created_at", createdAfter)
        .lt("created_at", createdBefore)
        .or("status.eq.SUCCEEDED,status.eq.PENDING,status.eq.FAILED")
        .order("created_at", {ascending: false})
        .limit(limit)

    if(error){
        console.log(error)
        throw error;
    }

    return convertKeysToCamelCase(data);
}

const checkBalanceDeductChangeExists = async (feeId) => {

    const { data, error } = await supabaseCall(() => supabase
        .from("balance_change_log")
        .select()
        .eq("fee_id", feeId)
        .maybeSingle());

    if(error) throw error;
    return !!data;

}

module.exports = {
    addBaseBalanceRecord,
    deductBalance,
    topupBalance,
    getBalance,
    getTotalBalanceTopups,
    getBalanceTopupsHistory,
    insertBalanceTopupRecord,
    updateBalanceTopupRecord,
    checkBalanceDeductChangeExists
}