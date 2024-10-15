const getBastionUser = require("../bastion/main/getBastionUser")
const { getAllUserWallets, getAllUserWalletsWithProvider } = require("../bastion/utils/getAllUserWallets")
const supabase = require("../supabaseClient")
const { supabaseCall } = require("../supabaseWithRetry")
const { CustomerStatus } = require("./common")

const getUserWalletStatus = async (userId, walletType="INDIVIDUAL") => {
    // get user wallets & provider
    const [userBastionWallets, userCircleWallets] = await Promise.all([
        getAllUserWalletsWithProvider(userId, "BASTION", walletType),
        getAllUserWalletsWithProvider(userId, "CIRCLE", walletType)
    ])

    // get provider if both, default to bastion
    let provider = null
    const bastionWalletsCount = Object.keys(userBastionWallets).length
    const circleWalletsCount = Object.keys(userCircleWallets).length
    if (bastionWalletsCount > 0 && circleWalletsCount === 0) provider = "BASTION"
    else if (bastionWalletsCount === 0 && circleWalletsCount > 0) provider = "CIRCLE"
    else if (bastionWalletsCount > 0 && circleWalletsCount > 0) provider = "BASTION"
    else {
        // no wallet found
        return {
            status: 200,
            walletStatus: CustomerStatus.INACTIVE,
            invalidFileds: [],
            actions: ["update"],
            walletAddress: {},
            message: "please call user/update to reactivate",
            walletProvider: null
        }
    }

    // get wallet status
    if (provider === "CIRCLE"){
        // get circle wallet status
        return {
            status: 200,
            walletStatus: CustomerStatus.ACTIVE,
            invalidFileds: [],
            actions: [],
            walletAddress: userCircleWallets,
            message: "",
            walletProvider: "CIRCLE"
        }
    }
    else{
        // get bastion wallet status
        const bastionWalletStatus = await getBastionUser(userId)
        return {...bastionWalletStatus, walletProvider: "BASTION"}
    }
}

module.exports = {
    getUserWalletStatus
}