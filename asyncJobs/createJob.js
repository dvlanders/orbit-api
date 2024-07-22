const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");
const { jobMapping } = require("./jobMapping");


const JOB_ENV = process.env.JOB_ENV || "PRODUCTION"
const defalutRetryDeadline = 7 * 86400 * 1000 // 7days

const createJob = async(job, config, userId, profileId, createdAt=new Date().toISOString(), numberOfRetries=0, nextRetry=new Date().toISOString(), retryDeadline=new Date(new Date().getTime() + defalutRetryDeadline).toISOString(), retryInterval=60 * 1000) => {
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
                retry_deadline: retryDeadline,
                retry_interval: retryInterval,
                env: JOB_ENV
            })
        
        if (error) throw error
        return

    }catch (error){
        await createLog("asyncJob/createJob", userId, error.message)
    }
}

module.exports = createJob