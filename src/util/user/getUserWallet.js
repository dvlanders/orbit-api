const { getUserBalance } = require("../bastion/endpoints/getUserBalance")
const { getUserBalanceBastion } = require("../bastion/main/getWalletBalance")
const { getCircleWalletBalance } = require("../circle/main/getCircleWallet")
const supabase = require("../supabaseClient")

const getUserWallet = async (userId, chain, walletType="INDIVIDUAL") => {
    const {data: userWallet, error: userWalletError} = await supabase
        .from('user_wallets')
        .select('*, bastionWallet: bastion_wallet_id(*), circleWallet: circle_wallet_id(*)')
        .eq('user_id', userId)
        .eq('chain', chain)
        .eq('wallet_type', walletType)
        .maybeSingle()

    if (userWalletError) throw new Error(userWalletError.message)
    if (!userWallet) return {address: null, chain, walletType, walletProvider: null, bastionUserId: null, circleWalletId: null}

    let provider
    if (userWallet.bastionWallet) provider = "BASTION"
    else if (userWallet.circleWallet) provider = "CIRCLE"

    return {address: userWallet.address, chain, walletType, walletProvider: provider, bastionUserId: userWallet.bastionWallet?.bastion_user_id, circleWalletId: userWallet.circleWallet?.wallet_id}
}

const getUserWalletBalance = async (userId, chain, currency, walletType="INDIVIDUAL") => {
    const {walletProvider, bastionUserId, circleWalletId} = await getUserWallet(userId, chain, walletType)
    if (walletProvider === "BASTION") {
        return await getUserBalanceBastion(bastionUserId, chain, currency)
    }else if (walletProvider === "CIRCLE") {
        return await getCircleWalletBalance(circleWalletId, chain, currency)
    }else throw new Error("Unknown wallet provider")
}

module.exports = {
    getUserWallet,
    getUserWalletBalance
}