const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");


/**
 * The table should at least return wallet address based on provided chain and user_id
 */
const fetchUserWalletInformation = async(userId, chain, providerTable, type="INDIVIDUAL") => {
    const {data: userWallet, error: userWalletError} = await supabaseCall(() => supabase
        .from(providerTable)
        .select("*")
        .eq("user_id", userId)
        .eq("chain", chain)
        .eq("type", type)
        .maybeSingle()
        )

    if (userWalletError) throw new Error(userWalletError.message)
    return userWallet

}

module.exports = {
    fetchUserWalletInformation
}