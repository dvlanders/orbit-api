const { getAllUserWallets } = require("../bastion/utils/getAllUserWallets");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { CustomerStatus } = require("./common");
const { getRawUserObject } = require("./getRawUserObject");
const { getUserWalletStatus } = require("./getUserWalletStatus");
const { KycLevel } = require("./kycInfo");

const BridgeKycStatusMap = {
    active: CustomerStatus.ACTIVE,
    not_started: CustomerStatus.PENDING,
    under_review: CustomerStatus.PENDING,
    rejected: CustomerStatus.INACTIVE
}

const getAllUsers = async(userId, profileId, userType="all", limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    let users
    if (userId){
        const {data, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, kyc_level, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status)")
        .eq("profile_id", profileId)
        .not("user_kyc", "is", null)
        .eq("id", userId)
        .eq("is_developer", false)
        .limit(1)
        if (usersError) throw usersError
        users = data
    }
    else if (userType == "all"){
        const {data, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, kyc_level, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status)")
        .eq("profile_id", profileId)
        .eq("is_developer", false)
        .not("user_kyc", "is", null)
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)
        if (usersError) throw usersError
        users = data
    }else if (userType == "individual") {
        const {data, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, kyc_level, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed)")
        .eq("profile_id", profileId)
        .eq("is_developer", false)
        .not("user_kyc", "is", null)
        .eq("user_type", "individual")
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)
        if (usersError) throw usersError
        users = data
    }else if (userType == "business"){
        const {data, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, kyc_level, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), ultimate_beneficial_owners (id, legal_first_name, legal_last_name, compliance_email, compliance_phone, tax_identification_number)")
        .eq("profile_id", profileId)
        .eq("is_developer", false)
        .not("user_kyc", "is", null)
        .eq("user_type", "business")
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)
        if (usersError) throw usersError
        users = data
    }

    const result = await Promise.all(users.map(async(user) => {
        const name = user.user_kyc ? (user.user_type == "business" ? user.user_kyc.business_name : user.user_kyc.legal_first_name + " " + user.user_kyc.legal_last_name) : null
        const bridgeKycStatus = user.bridge_customers? BridgeKycStatusMap[user.bridge_customers.status] || CustomerStatus.INACTIVE : CustomerStatus.INACTIVE
        const walletstatus = await getUserWalletStatus(user.id)
        const userInfo = {
            userId: user.id,
            userType: user.user_type,
            name,
            dateOfBirth: user.user_kyc ? user.user_kyc.date_of_birth : null,
            email: user.user_kyc ? user.user_kyc.compliance_email: null,
            phone: user.user_kyc ? user.user_kyc.compliance_phone: null,
            createdAt: new Date(user.created_at),
            userKycStatus: user.kyc_level === KycLevel.ONE ? walletstatus.walletStatus : bridgeKycStatus, // represent wallet status if KYC level is 1, else represent bridge status
            userKycLevel: user.kyc_level, 
            walletStatus: walletstatus.walletStatus,
            walletAddress: walletstatus.walletAddress,
        }
        if (user.user_type == "business") {
            userInfo.ultimateBeneficialOwners = user.ultimate_beneficial_owners
        }
        return userInfo
    }))

    return result



}

module.exports = getAllUsers