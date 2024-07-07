const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");

const insertJobHistory = async(job, config, userId, profileId, success) => {
    try{
        // insert job
        const {data, error} = await supabaseCall(() => supabase
            .from("jobs_history")
            .insert({
                job,
                config,
                user_id: userId,
                profile_id: profileId,
                success
            }))
        
        if (error) throw error
        return

    }catch (error){
        createLog("asyncJob/insertJobHistory")
        return
    }
}

module.exports = insertJobHistory