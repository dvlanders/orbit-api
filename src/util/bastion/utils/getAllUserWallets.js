const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

const prodChains = ["POLYGON_MAINNET"]
const sandboxChains = ["POLYGON_AMOY"]

exports.getAllUserWallets = async(userId) => {
    
    let { data: bastion_wallets, error } = await supabase
        .from('bastion_wallets')
        .select('chain, address')
        .eq("user_id", userId)
        .in('chain', process.env.NODE_ENV === 'production' ? prodChains : sandboxChains);
    
    if (error) throw error

    const wallets = {}
    bastion_wallets.map((wallet) => {
        wallets[wallet.chain] = {
            address: wallet.address
        }
    })

    return wallets
        
}