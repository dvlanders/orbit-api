const supabase = require("../supabaseClient")

const getDeveloperUserId = async(profileId) => {
    const {data, error} = await supabase
        .from("profiles")
        .select("developer_user_id")
        .eq("id", profileId)
        .single()
    if (error) throw error
    if (!data) throw new Error(`No profile found for id ${profileId}`)

    return data.developer_user_id
}

module.exports = {
    getDeveloperUserId
}