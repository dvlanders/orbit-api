const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

const fetchUserWalletInformation = async(userId, chain) => {
    const {data: userWallet, error: userWalletError} = await supabaseCall(() => supabase
        .from("bastion_wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("chain", chain)
        .maybeSingle()
        )

    if (userWalletError) throw new Error(userWalletError.message)
    return userWallet

}

module.exports = {
    fetchUserWalletInformation
}