const supabase = require("../../supabaseClient")


const getKycKybAmount = async (profileId, startDate, endDate, type) => {

    const {count, error} = await supabase
        .from("bridge_customers")
        .select("*, users: user_id!inner(*)", {count: 'exact', head: true})
        .eq("users.profile_id", profileId)
        .eq("users.type", type)
        .not("status", "is", null)
        .neq("status", "invalid_fields")
        .gte("created_at", startDate)
        .lt("created_at", endDate)
        
    if (error) throw error
    return count || 0
}

module.exports = {
    getKycKybAmount
}