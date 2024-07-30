const { createClient } = require("@supabase/supabase-js");
const { supabaseCall } = require("../../supabaseWithRetry");
const crypto = require('crypto');
let supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const supabaseSandbox = require("../../sandboxSupabaseClient");

const activateWebhook = async(webhookUrl, profileId, env) => {
    let supabaseClient
    if (env == "sandbox"){
        supabaseClient = supabaseSandbox
    }else{
        supabaseClient = supabase
    }
    const secretKey = crypto.randomBytes(64).toString('hex');


    const { data, error } = await supabaseClient
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
