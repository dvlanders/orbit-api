const supabase = require("../src/util/supabaseClient");
const { supabaseCall } = require("../src/util/supabaseWithRetry");

exports.deleteJob = async(jobId) => {
    try{
        const {data, error} = await supabaseCall(() => supabase
            .from("jobs_queue")
            .delete()
            .eq("id", jobId))

        if (error) throw error
        return
    }catch (error){
        createLog("asyncJobs/deleteJob", "", error.message, {jobId: jobId})
        return
    }
}