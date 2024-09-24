const supabase = require("../supabaseClient")

const aquireAutopayLock = async (profileId) => {

    console.log("aquire_auto_lock", profileId)
    const { data, error } = await supabase.rpc('aquire_auto_lock', { profile_id_arg: profileId });
    if(error){
        console.log(error)
        throw error;
    }

    return data;
}

const releaseAutopayLock = async (profileId) => {

    console.log("release_auto_lock", profileId)
    const { data, error } = await supabase.rpc('release_auto_lock', { profile_id_arg: profileId });
    if(error){
        console.log(error)
        throw error;
    }

    return data;
}



module.exports = {
    aquireAutopayLock,
    releaseAutopayLock
}