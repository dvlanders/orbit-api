const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const getAllUsers = async(profileId, limit=10, createdAfter=new Date("1900-01-01").toISOString(), createdBefore=new Date("2200-01-01").toISOString()) => {
    console.log(createdAfter, createdBefore)
    const {data: users, error: usersError} = await supabase
        .from("users")
        .select("id, created_at, user_kyc (legal_first_name, legal_last_name, date_of_birth, compliance_email, compliance_phone)")
        .eq("profile_id", profileId)
        .lt("created_at", createdBefore)
        .gt("created_at", createdAfter)
        .order("created_at", {ascending: false})
        .limit(limit)

    
    if (usersError) throw usersError
    const result = users.map((user) => {
        return {
            userId: user.id,
            name: user.user_kyc ? user.user_kyc.legal_first_name + " " + user.user_kyc.legal_last_name : null,
            dateOfBirth: user.user_kyc ? user.user_kyc.date_of_birth : null,
            email: user.user_kyc ? user.user_kyc.compliance_email: null,
            phone: user.user_kyc ? user.user_kyc.compliance_phone: null,
            createdAt: new Date(user.created_at),
        }
    })

    return result



}

module.exports = getAllUsers