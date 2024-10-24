const { deleteJob } = require("../../asyncJobs/deleteJob");
const { updateJob } = require("../../asyncJobs/updateJob");
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
        .update({
            in_process: true
        })
        .lt('next_retry', now.toISOString())
        .gt('retry_deadline', now.toISOString())
        .eq("env", JOB_ENV)
        .eq("in_process", false)
        .select("*")
        .order('next_retry', {ascending: true})
    
        if (error) {
            return await createLog("pollAsyncJobs", null, error.message, error)
        }
    
        await Promise.all(jobsQueue.map(async(job) => {
            let success = false, reschedule = false, retry = false, retryReason = "", jobError = null;
            try{
                const jobFunc = jobMapping[job.job].execute
                const result = await jobFunc({userId: job.user_id, profileId: job.profile_id, ...job.config})

                if(result?.retryDetails?.retry){
                    const { retry: shouldRetry, delay, reason } = result.retryDetails;
                    const toUpdate = {
                        number_of_retries: job.number_of_retries + 1,
                        next_retry: new Date(now.getTime() + delay).toISOString(),
                        in_process: false
                    };
                    await updateJob(job.id, toUpdate);
                    retry = shouldRetry;
                    retryReason = reason;
                }
                success = true

            }catch(error){
                if ((error instanceof JobError && error.logging) || !(error instanceof JobError)){
                    await createLog("pollAsyncJobs", job.user_id, error.message)
                }
                // record error and create new job if needed
                if (error instanceof JobError){
                    if (error.needToReschedule) {
                        reschedule = true;
                        const toUpdate = {
                            number_of_retries: job.number_of_retries + 1,
                            next_retry: new Date(now.getTime() + job.retry_interval).toISOString(),
                            in_process: false
                        };
                        await updateJob(job.id, toUpdate);
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
            }finally{
                await insertJobHistory(job.job, job.config, job.user_id, job.profile_id, success, jobError, retry, retryReason)
                if((success && !retry) || (!success && !reschedule)) await deleteJob(job.id)
            }
        }))
    }catch (error){
        await createLog("pollAsyncJobs", null, error.message, error)
    }
}

module.exports = pollAsyncJobs