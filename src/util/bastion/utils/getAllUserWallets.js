const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");

const prodChains = ["POLYGON_MAINNET", "ETHEREUM_MAINNET"]
const sandboxChains = ["POLYGON_AMOY"]

exports.getAllUserWallets = async(userId, walletType="INDIVIDUAL") => {
    
    let { data, error } = await supabase
        .from('user_wallets')
        .select('chain, address')
        .eq("user_id", userId)
        .eq("wallet_type", walletType)
        .in('chain', process.env.NODE_ENV === 'production' ? prodChains : sandboxChains);
    
    if (error) throw error

    const wallets = {}
    data.map((wallet) => {
        wallets[wallet.chain] = {
            address: wallet.address
        }
    })

    return wallets
        
}

exports.getAllUserWalletsWithProvider = async(userId, walletProvider, walletType="INDIVIDUAL") => {
    
    let { data, error } = await supabase
        .from('user_wallets')
        .select('chain, address')
        .eq("user_id", userId)
        .eq("wallet_provider", walletProvider)
        .eq("wallet_type", walletType)
        .in('chain', process.env.NODE_ENV === 'production' ? prodChains : sandboxChains);
    
    if (error) throw error

    const wallets = {}
    data.map((wallet) => {
        wallets[wallet.chain] = {
            address: wallet.address
        }
    })

    return wallets
        
}