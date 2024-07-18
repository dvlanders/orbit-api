const supabase = require("../../supabaseClient")

const acceptedFeeType = new Set(["PERCENT", "FIX"])

const canChargeFee = async(profileId) => {
    const {data, error} = await supabase
        .from("profiles")
        .select("developer_user_id, fee_collection_enabled")
        .eq("id", profileId)
        .single()

    if (error) throw error

    if (!data.developer_user_id || !data.fee_collection_enabled) return false
    return true
}

module.exports = {
    acceptedFeeType,
    canChargeFee
}