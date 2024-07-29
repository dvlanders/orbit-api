const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

exports.getAllUserWallets = async(userId) => {
    
    let { data: bastion_wallets, error } = await supabase
        .from('bastion_wallets')
        .select('chain, address')
        .eq("user_id", userId)
    
    if (error) throw error

    const wallets = {}
    bastion_wallets.map((wallet) => {
        if((process.env.NODE_ENV == "production" && wallet.chain == "POLYGON_MAINNET") ||
           (process.env.NODE_ENV == "development" && wallet.chain == "POLYGON_AMOY")){
            wallets[wallet.chain] = {
                address: wallet.address
            }
        }
    })

    return wallets
        
}