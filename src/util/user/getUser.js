const supabase = require("../supabaseClient")

const getUserProfileId = async(userId) => {
    const {data, error} = await supabase
        .from("users")
        .select("profile_id")
        .eq("id", userId)
        .maybeSingle()
    
    if (error) throw error
    if (!data) throw new Error(`No User found for this userId ${userId}`)
    return data.profile_id
}

module.exports = {
    getUserProfileId
}