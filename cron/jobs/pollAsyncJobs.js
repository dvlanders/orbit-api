const createJob = require("../../asyncJobs/createJob");
const { deleteJob } = require("../../asyncJobs/deleteJob");
const { JobError } = require("../../asyncJobs/error");
const insertJobHistory = require("../../asyncJobs/insertJobHistory");
const { jobMapping } = require("../../asyncJobs/jobMapping");
const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");

const dayAfterCreated = 3
const initialRetryInterval = 60 * 1000 // 60 secs
const maxRetryInterval = 3600 * 1000 // 1 hr
const retryAlertThreshold = 100

const JOB_ENV = process.env.JOB_ENV || "PRODUCTION"


const pollAsyncJobs = async() => {
    try{
        // get all the job that has next_retry smaller than currenct time and sort in asceding order
        const now = new Date()
        let { data: jobsQueue, error } = await supabase
        .from('jobs_queue')
        // .update({
        //     in_process: true
        // })
        // .lt('next_retry', now.toISOString())
        // .gt('retry_deadline', now.toISOString())
        // .eq("env", JOB_ENV)
        // .eq("in_process", false)
        .select("*")
        // .order('next_retry', {ascending: true})
    
        if (error) {
            await createLog("pollAsyncJobs", null, error.message, error)
            return
        }
    
        await Promise.all(jobsQueue.map(async(job) => {
            let success
            let jobError
            try{
                const jobFunc = jobMapping[job.job].execute
                await jobFunc({userId: job.user_id, profileId: job.profile_id, ...job.config})
                // await deleteJob(job.id)
                success = true
            }catch(error){
                if ((error instanceof JobError && error.logging) || !(error instanceof JobError)){
                    await createLog("pollAsyncJobs", job.user_id, error.message)
                }
                // record error and create new job if needed
                if (error instanceof JobError){
                    if (error.needToReschedule) {
                        const newNextRetry = new Date(now.getTime() + job.retry_interval).toISOString()
                        await createJob(job.job, job.config, job.user_id, job.profile_id, job.created_at, job.number_of_retries, newNextRetry, job.retry_deadline, job.retry_interval)
                        if(job.number_of_retries > retryAlertThreshold){
                            await createLog("pollAsyncJobs", job.user_id, `Job has been retried ${job.number_of_retries} times`, error.message)
                        }
                    }
                    jobError = {
                        type: error.type,
                        message: error.message,
                        json: error.json,
                        rawResponse: error.rawResponse,
                        needToReschedule: error.needToReschedule
                    }
                }else{
                    jobError = {
                        type: "INTERNAL_ERROR",
                        message: error.message,
                        json: error,
                        rawResponse: error,
                    }
                }
                // delete the job after create a new one
                // await deleteJob(job.id)
                success = false
            }finally{
                await insertJobHistory(job.job, job.config, job.user_id, job.profile_id, success, jobError)
            }
        }))
    }catch (error){
        await createLog("pollAsyncJobs", null, error.message, error)
    }
}

module.exports = pollAsyncJobs