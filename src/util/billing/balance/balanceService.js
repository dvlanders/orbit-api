const { update } = require("../../Constants");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")

const deductBalance = async (profileId, feeId, amount) => {

    //TODO: These should all be done in a transaction with Supabase RPC
    // const { data: currentBalance, error: currentBalanceError } = await supabase
    // .from("balance")
    // .select("balance")
    // .eq("profile_id", profileId);

    // if(currentBalanceError) throw currentBalanceError;

    // const { data: balanceChange, error: balanceChangeError } = await supabase
    //     .from("balance_change_log")
    //     .insert({
    //         profile_id: profileId,
    //         balance_id: currentBalance.id,
    //         fee_id: feeId,
    //         amount: amount,
    //         balance_before: currentBalance,
    //         balance_after: currentBalance - amount,
    //         type: "DEDUCTION"
    //     })
    //     .eq("profile_id", profileId);

    // if(balanceChangeError) throw balanceChangeError;

    // const { data: newBalance, error: newBalanceError } = await supabase
    //     .from("balance")
    //     .update({
    //         profile_id: profileId,
    //         balance: balanceChange.balance_after,
    //         updated_at: new Date().toISOString()
    //     })
    //     .eq("profile_id", profileId);

    // if(newBalanceError) throw newBalanceError;


    // return newBalance;
    
}

const topupBalance = async (profileId, amount) => {

    //TODO: These should all be done in a transaction with Supabase RPC
    console.log("topupBalance", profileId, amount)
    // const { data: currentBalance, error: currentBalanceError } = await supabase
    // .from("balance")
    // .select("balance")
    // .eq("profile_id", profileId);

    // if(currentBalanceError) throw currentBalanceError;

    // const { data: balanceChange, error: balanceChangeError } = await supabase
    //     .from("balance_change_log")
    //     .insert({
    //         profile_id: profileId,
    //         balance_id: currentBalance.id,
    //         amount: amount,
    //         balance_before: currentBalance,
    //         balance_after: currentBalance + amount,
    //         type: "TOPUP"
    //     })
    //     .eq("profile_id", profileId);

    // if(balanceChangeError) throw balanceChangeError;

    // const { data: newBalance, error: newBalanceError } = await supabase
    //     .from("balance")
    //     .update({
    //         profile_id: profileId,
    //         balance: balanceChange.balance_after,
    //         updated_at: new Date().toISOString()
    //     })
    //     .eq("profile_id", profileId);

    // if(newBalanceError) throw newBalanceError;


    // return newBalance;

}


module.exports = {
    deductBalance,
    topupBalance
}