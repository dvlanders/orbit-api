const supabase = require("../../supabaseClient")

const getUserReapApiCred = async(userId) => {
    let apiKey, entityId
    // get user api key
    const {data: reapUser, error: reapUserError} = await supabase
        .from("reap_users")
        .select("api_key, entity_id")
        .eq("user_id", userId)
        .maybeSingle()
    
    if (reapUserError) throw reapUserError
    // if (!reapUser) throw CreateCryptoToBankTransferError(CreateCryptoToBankTransferErrorType.CLIENT_ERROR, "Destination user is not allowed to accept fund through this rail")
    if (!reapUser){
        apiKey = process.env.REAP_API_KEY
        entityId = process.env.REAP_BUSINESS_UUID
    }else{
        apiKey = reapUser.api_key
        entityId = reapUser.entity_id
    }

    return {apiKey, entityId}
}

module.exports = getUserReapApiCred