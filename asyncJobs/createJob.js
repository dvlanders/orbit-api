const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const jobMapping = require("./jobMapping");

const createJob = async(job, config, userId, profileId, createdAt=new Date().toISOString(), numberOfRetries=0, nextRetry=new Date().toISOString()) => {
    try{
        if (! (job in jobMapping)) throw new Error(`Job: ${job} not registered`)
        // check if the job can be insert
        const scheduleCheck = jobMapping[job].scheduleCheck
        if (!await scheduleCheck(job, config, userId, profileId)) return

        // insert job
        const {data, error} = await supabase
            .from("jobs_queue")
            .insert({
                job,
                config,
                user_id: userId,
                profile_id: profileId,
                created_at: createdAt,
                next_retry: nextRetry,
                number_of_retries: numberOfRetries + 1,
            })
        
        if (error) throw error
        return

    }catch (error){
        createLog("asyncJob/createJob")
    }
}

module.exports = createJob