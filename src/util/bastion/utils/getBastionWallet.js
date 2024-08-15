const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.getBastionWallet = async(userId, chain, type="INDIVIDUAL") => {
    const { data: walletData, error: walletError } = await supabaseCall(() => supabase
        .from('bastion_wallets')
        .select('address, bastion_user_id')
        .eq('user_id', userId)
        .eq('chain', chain)
        .eq("type", type)
        .maybeSingle())
    
    if (walletError) throw walletError
    if (!walletData) return {walletAddress: null, bastionUserId: null}

    return {walletAddress: walletData.address, bastionUserId: walletData.bastion_user_id}
}