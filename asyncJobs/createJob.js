const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");
const { hashObject } = require("../src/util/utils/object");
const areObjectsEqual = require("./utils/configCompare");
const {
    createHash,
  } = require('node:crypto');


const JOB_ENV = process.env.JOB_ENV || "PRODUCTION"
const defalutRetryDeadline = 7 * 86400 * 1000 // 7days

const defaultAsyncJobSettings = {
    allowDuplicate: false,
    createdAt: new Date().toISOString(),
    numberOfRetries: 0,
    nextRetry: new Date().toISOString(),
    retryDeadline: new Date(new Date().getTime() + defalutRetryDeadline).toISOString(),
    retryInterval: 60 * 1000,
    additionalChecks: []
}

/**
 * 
 * @param {*} job 
 * @param {*} config 
 * @param {*} userId 
 * @param {*} profileId 
 * @param {Object} _asyncJobSettings - Optional settings to override default async job behavior
 * @param {boolean} _asyncJobSettings.allowDuplicate - Whether to allow duplicate jobs (default: false)
 * @param {string} _asyncJobSettings.createdAt - ISO timestamp for job creation (default: current time)
 * @param {number} _asyncJobSettings.numberOfRetries - Number of times job has been retried (default: 0)
 * @param {string} _asyncJobSettings.nextRetry - ISO timestamp for next retry attempt (default: current time)
 * @param {string} _asyncJobSettings.retryDeadline - ISO timestamp for final retry deadline (default: 7 days from now)
 * @param {number} _asyncJobSettings.retryInterval - Milliseconds between retry attempts (default: 60000)
 * @param {Function[]} _asyncJobSettings.additionalChecks - Array of additional check functions to run (default: [])
 * @returns 
 */
const createJob = async(job, config, userId, profileId, _asyncJobSettings) => {
    // setup async job settings, and override default settings if provided
    const asyncJobSettings = {
        ...defaultAsyncJobSettings, 
        ..._asyncJobSettings
    }
    const { createdAt, numberOfRetries, nextRetry, retryDeadline, retryInterval, allowDuplicate, additionalChecks } = asyncJobSettings

    try{

        // create unique identifier for job
        const toHash = {...config, job}
        if (allowDuplicate) toHash.nonce = v4()
        const jobUniqueIdentifier = hashObject(toHash)

        // additional checks
        for (const check of additionalChecks){
            if (!(await check(job, config, userId))) return {duplicate: false, passCheck: false}
        }
        // insert job
        const { data, error } = await supabase
            .from("jobs_queue")
            .upsert({
                job,
                config,
                user_id: userId,
                profile_id: profileId,
                created_at: createdAt,
                next_retry: nextRetry,
                number_of_retries: numberOfRetries + 1,
                retry_deadline: retryDeadline,
                retry_interval: retryInterval,
                env: JOB_ENV,
                job_unique_identifier: jobUniqueIdentifier
            }, {
                onConflict: "job_unique_identifier",
                ignoreDuplicates: true
            })
            .select()
            .maybeSingle()
        
        if (error) throw error
        if (!data) return {duplicate: true, passCheck: true}
        return {duplicate: false, passCheck: true, record: data}

    }catch (error){
        console.error(error)
        await createLog("asyncJob/createJob", userId, error.message, error)
        throw error
    }
}

module.exports = createJob