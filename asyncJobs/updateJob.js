const createLog = require("../src/util/logger/supabaseLogger");
const supabase = require("../src/util/supabaseClient");

const updateJob = async(jobId, toUpdate) => {
    try{
        // insert job
        const { error } = await supabase
            .from("jobs_queue")
            .update(toUpdate)
            .eq("id", jobId)
        
        if (error) throw error

    }catch (error){
        await createLog("asyncJob/updateJob", null, error.message, error)
    }
}

module.exports = {
    updateJob
}