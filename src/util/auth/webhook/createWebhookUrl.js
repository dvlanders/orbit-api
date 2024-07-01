const { createClient } = require("@supabase/supabase-js");
const { supabaseCall } = require("../../supabaseWithRetry");
const crypto = require('crypto');
let supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");

const activateWebhook = async(webhookUrl, profileId, env) => {
    if (env == "sandbox"){
        supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
    }
    const secretKey = crypto.randomBytes(64).toString('hex');


    const { data, error } = await supabase
    .from('webhook_urls')
    .upsert({ 
        profile_id: profileId, 
        webhook_url: webhookUrl,
        webhook_secret: secretKey
    }
    , {onConflict: "profile_id"})
    .select()

    if (error) throw error
    return secretKey
        

}

module.exports = activateWebhook
