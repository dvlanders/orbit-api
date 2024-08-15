const { createClient } = require("@supabase/supabase-js");
const { supabaseCall } = require("../../supabaseWithRetry");
const crypto = require('crypto');
let supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const supabaseSandbox = require("../../sandboxSupabaseClient");
const generateKeyPair = require("./generateKeyPair");

const activateWebhook = async(webhookUrl, profileId, env) => {
    let supabaseClient
    if (env == "sandbox"){
        supabaseClient = supabaseSandbox
    }else{
        supabaseClient = supabase
    }

    const keys = await generateKeyPair()

    const { data, error } = await supabaseClient
    .from('webhook_urls')
    .upsert({ 
        profile_id: profileId, 
        webhook_url: webhookUrl,
        webhook_public_key: keys.publicKey.replace(/\n/g, '\\n'),
        webhook_signing_secret: keys.privateKey.replace(/\n/g, '\\n')
    }
    , {onConflict: "profile_id"})
    .select("webhook_public_key")
    .single()

    if (error) throw error
    return data.webhook_public_key
        

}

module.exports = activateWebhook
