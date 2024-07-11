
const createLog = require("../../../src/util/logger/supabaseLogger")
const supabase = require("../../../src/util/supabaseClient")

const dayAfterCreated = 3


const pollCleanWebhookQueue = async() => {
    // delete the queued message that has first_retry smaller than currenct time
    while (true){

        const now = new Date()
        let { data: webhookQueue, error } = await supabase
        .from('webhook_queue')
        .delete()
        .lt('first_retry', new Date(now.getTime() - dayAfterCreated * 24 * 60 * 60 * 1000).toISOString())
        .select()
    
        if (error) {
            createLog("pollCleanWebhookQueue", "", error.message)
            return
        }
        if (!webhookQueue || webhookQueue.length <= 0) break
    }

}



module.exports = pollCleanWebhookQueue