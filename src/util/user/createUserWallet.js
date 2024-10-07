const createAndFundBastionUser = require("../bastion/main/createAndFundBastionUser");
const { createCircleWallet } = require("../circle/main/createCircleWallet");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { ipCheck } = require("./createUser");

const createUserWallet = async (userId, walletType="INDIVIDUAL") => {
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
    return await walletCreationFunction(userId, walletType)
}

module.exports = { createUserWallet }
