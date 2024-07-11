const createJob = require("../../asyncJobs/createJob");
const insertJobHistory = require("../../asyncJobs/insertJobHistory");
const jobMapping = require("../../asyncJobs/jobMapping");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");

const dayAfterCreated = 3
const initialRetryInterval = 60 * 1000 // 60 secs
const maxRetryInterval = 3600 * 1000 // 1 hr

const JOB_ENV = process.env.JOB_ENV || "PRODUCTION"

const pollAsyncJobs = async() => {
    try{
        // get all the job that has next_retry smaller than currenct time and sort in asceding order
        const now = new Date()
        let { data: jobsQueue, error } = await supabase
        .from('jobs_queue')
        .delete()
        .lt('next_retry', now.toISOString())
        .gt('created_at', new Date(now.getTime() - dayAfterCreated * 24 * 60 * 60 * 1000).toISOString())
        .eq("env", JOB_ENV)
        .select("*")
        .order('next_retry', {ascending: true})
    
        if (error) {
            createLog("pollAsyncJobs", "", error.message)
            return
        }
    
        await Promise.all(jobsQueue.map(async(job) => {
            let success
            try{
                const jobFunc = jobMapping[job.job].execute
                await jobFunc(job.config)
                success = true
            }catch(error){
                await createLog("pollAsyncJobs", job.user_id, error.message)
                const jitter = Math.random() * Math.min(initialRetryInterval * job.number_of_retries, maxRetryInterval)
                const newNextRetry = new Date(now.getTime() + jitter).toISOString()
                success = false
                await createJob(job.job, job.config, job.user_id, job.profile_id, job.created_at, job.number_of_retries, newNextRetry)
            }finally{
                await insertJobHistory(job.job, job.config, job.user_id, job.profile_id, success)
            }
        }))
    }catch (error){
        createLog("pollAsyncJobs", "", error.message, )
    }
}

module.exports = pollAsyncJobs