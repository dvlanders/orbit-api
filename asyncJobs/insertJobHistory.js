const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");

const insertJobHistory = async(job, config, userId, profileId, success, jobError) => {
    try{
        // insert job
        const {data, error} = await supabaseCall(() => supabase
            .from("jobs_history")
            .insert({
                job,
                config,
                user_id: userId,
                profile_id: profileId,
                success,
                error: jobError,
            }))
        
        if (error) throw error
        return

    }catch (error){
        await createLog("asyncJob/insertJobHistory", userId, error.message, error)
        return
    }
}

module.exports = insertJobHistory