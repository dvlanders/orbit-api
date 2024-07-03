const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const getAllUsers = async(profileId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {

    const {data: users, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, user_type, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone, business_name), bridge_customers (status), bastion_users (kyc_passed, jurisdiction_check_passed), bastion_wallets (address, chain)")
        .eq("profile_id", profileId)
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)


    if (usersError) throw usersError
    const result = users.map((user) => {
        const name = user.user_kyc ? (user.user_type == "business" ? user.user_kyc.business_name : user.user_kyc.legal_first_name + " " + user.user_kyc.legal_last_name) : null
        const bridgeKycStatus = user.bridge_customers? (user.bridge_customers.status == "active" ? "ACTIVE" : "INACTIVE") : "INACTIVE"
        const walletstatus = user.bastion_users ? (user.bastion_users.kyc_passed && user.bastion_users.jurisdiction_check_passed ? "ACTIVE" : "INACTIVE") : "INACTIVE"
        const EVMwalletAddress = user.bastion_wallets && user.bastion_wallets.length > 0 ? user.bastion_wallets.find((wallet) => wallet.chain == "POLYGON_MAINNET") : null
        return {
            userId: user.id,
            userType: user.user_type,
            name,
            dateOfBirth: user.user_kyc ? user.user_kyc.date_of_birth : null,
            email: user.user_kyc ? user.user_kyc.compliance_email: null,
            phone: user.user_kyc ? user.user_kyc.compliance_phone: null,
            createdAt: new Date(user.created_at),
            userKycStatus: bridgeKycStatus, // now only represent bridge, which has the most functionality
            walletStatus: walletstatus, // only represent bastion now
            walletAddress: user.bastion_wallets
        }
    })

    return result



}

module.exports = getAllUsers