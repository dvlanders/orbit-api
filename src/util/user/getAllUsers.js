const { getAllUserWallets } = require("../bastion/utils/getAllUserWallets");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");
const { CustomerStatus } = require("./common");
const { getRawUserObject } = require("./getRawUserObject");

const getAllUsers = async(userId, profileId, userType="all", limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    let users
    if (userId){
        const {data, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain)")
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
        .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain)")
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
        .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain)")
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
        .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain), ultimate_beneficial_owners (id, legal_first_name, legal_last_name, compliance_email, compliance_phone, tax_identification_number)")
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
        const bridgeKycStatus = user.bridge_customers? (user.bridge_customers.status == "active" ? CustomerStatus.ACTIVE : user.bridge_customers.status == "not_started"? CustomerStatus.PENDING : CustomerStatus.INACTIVE) : CustomerStatus.INACTIVE
        const walletstatus = user.bastion_users ? (user.bastion_users.kyc_passed && user.bastion_users.jurisdiction_check_passed ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE) : CustomerStatus.INACTIVE
        const EVMwalletAddress = user.bastion_wallets && user.bastion_wallets.length > 0 ? user.bastion_wallets.find((wallet) => wallet.chain == "POLYGON_MAINNET") : null
        const userInfo = {
            userId: user.id,
            userType: user.user_type,
            name,
            dateOfBirth: user.user_kyc ? user.user_kyc.date_of_birth : null,
            email: user.user_kyc ? user.user_kyc.compliance_email: null,
            phone: user.user_kyc ? user.user_kyc.compliance_phone: null,
            createdAt: new Date(user.created_at),
            userKycStatus: bridgeKycStatus, // now only represent bridge, which has the most functionality
            walletStatus: walletstatus, // only represent bastion now
            walletAddress: await getAllUserWallets(user.id),
        }
        if (user.user_type == "business") {
            userInfo.ultimateBeneficialOwners = user.ultimate_beneficial_owners
        }
        return userInfo
    }))

    return result



}

module.exports = getAllUsers