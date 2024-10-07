const createAndFundBastionUser = require("../bastion/main/createAndFundBastionUser")
const updateBastionDeveloperUser = require("../bastion/main/updateBastionDeveloperUser")
const { createCircleWallet } = require("../circle/main/createCircleWallet")
const { checkAndUpdateCircleWallet } = require("../circle/main/updateCircleWallet")
const { Chain } = require("../common/blockchain")
const createLog = require("../logger/supabaseLogger")
const supabase = require("../supabaseClient")
const { supabaseCall } = require("../supabaseWithRetry")
const { CustomerStatus } = require("./common")
const { ipCheck } = require("./createUser")
const { getUserWallet } = require("./getUserWallet")
const { getUserWalletStatus } = require("./getUserWalletStatus")


// This function should only be used to create wallets for users if non have been created yet
const updateUserWallet = async (userId, walletType="INDIVIDUAL") => {
    try{
        const walletStatus = await getUserWalletStatus(userId, walletType)
        const wallets = walletStatus.walletAddress
        const walletCount = Object.keys(wallets).length

        // wallets already exist
        if (walletCount > 0) return walletStatus

        // create wallets based on ipAddress
        const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
                .from('user_kyc')
                .select('ip_address')
                .eq('user_id', userId)
                .single()
        )

        if (userKycError) throw new Error(userKycError.message)

        const ipAddress = userKyc.ip_address
        const {isIpAllowed} = await ipCheck(ipAddress);
        const walletCreationFunction = isIpAllowed ? createAndFundBastionUser : createCircleWallet
        const walletResult = await walletCreationFunction(userId, walletType)
        return walletResult
    } catch (error) {
        await createLog("user/updateUserWallet", userId, error.message, error)
        return {
            status: 500,
            walletStatus: CustomerStatus.INACTIVE,
            invalidFileds: [],
            actions: [],
            walletAddress: {},
            message: "Unexpected error happened, please contact HIFI for more information"
        }
    }
}

const updateDeveloperUserWallet = async (userId, walletTypes=["FEE_COLLECTION", "PREFUNDED"]) => {
    try {
        // get user Ip address
        const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
            .from('user_kyc')
            .select('ip_address')
            .eq('user_id', userId)
                    .single()
            )

        if (userKycError) throw new Error(userKycError.message)

        // create wallet based on ip address
        const ipAddress = userKyc.ip_address
        const {isIpAllowed} = await ipCheck(ipAddress);
        const walletUpdateFunction = isIpAllowed ? updateBastionDeveloperUser : checkAndUpdateCircleWallet
        await walletUpdateFunction(userId, walletTypes)
    } catch (error) {
        await createLog("user/updateDeveloperUserWallet", userId, error.message, error)
    }
}

module.exports = { 
    updateUserWallet,
    updateDeveloperUserWallet
 }
