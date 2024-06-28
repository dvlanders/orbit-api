const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchUserWalletInformation = async(userId, chain, providerTable) => {
    const {data: userWallet, error: userWalletError} = await supabaseCall(() => supabase
        .from(providerTable)
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