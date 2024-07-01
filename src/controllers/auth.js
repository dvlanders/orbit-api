const { createClient } = require("@supabase/supabase-js");
const { createApiKeyFromProvider } = require("../util/auth/createApiKey/createZuploApiKey");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { verifyToken } = require("../util/helper/verifyToken");
const createLog = require("../util/logger/supabaseLogger");
const { supabaseCall } = require("../util/supabaseWithRetry");
const activateWebhook = require("../util/auth/webhook/createWebhookUrl");

exports.createApiKey = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
        // this token will be supabase auth token
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({error: "Not authorized"});
        };

        // get user info (user_id)
        const user = await verifyToken(token);
        if (!user && !user?.sub) {
            return res.status(401).json({ error: "Not authorized" });
        };
        const profileId = user.sub
        const fields = req.body
        const { apiKeyName, expiredAt, env } = fields

        if (env == "production"){
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
            const {data: profile, error: profileError} = await supabaseCall(() => supabase
                .from("profiles")
                .select("prod_enabled")
                .eq("id", profileId)
                .maybeSingle())
            if (profileError) throw profileError
            if (!profile.prod_enabled) return res.status(401).json({error: "Please contact HIFI for activating production environment"})
        }s

        // dev spin up sandbox profile if not yet exist
        if (env == "sandbox"){
            const supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
            const {data: sandboxProfile, error: sandboxProfileError} = await supabaseCall(() => supabase
                .from("profiles")
                .select("id")
                .eq("id", profileId)
                .maybeSingle())
            
            if (sandboxProfileError) throw sandboxProfileError
            if (!sandboxProfile){
                // insert new profile
                const {data: newSandboxProfile, error: newSandboxProfileError} = await supabaseCall(() => supabase
                    .from("profiles")
                    .insert({
                        id: profileId
                    }))
                if (newSandboxProfileError) throw newSandboxProfileError
            }
        }


        // filed validation
        const {missingFields, invalidFields} = fieldsValidation(fields, ["apiKeyName", "expiredAt", "env"], {"apiKeyName": "string", "expiredAt": "string", "env": "string"})
        if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })

        const apikeyInfo = await createApiKeyFromProvider(profileId, apiKeyName, expiredAt, env)
        return res.status(200).json(apikeyInfo)

    }catch (error){
        console.error(error)
        createLog("auth/createApiKey", "", error.message, error)
        return res.status(500).json({error: "Internal server error"})
    }

}


exports.createProfileInSandbox = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try{
        const supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
        // insert new profile
        const { record } = req.body
        const {data, error} = await supabaseCall(() => supabase
            .from("profiles")
            .insert({
                id: record.id
            }))
        if (error) throw error
        return res.status(200).json({message: "sandbox profiles create successfully"})
        
    }catch (error){
        createLog("auth/createProfileInSandbox", "", `Fail to create profile for: ${record.id}, ${error.message}`)
        return res.status(500).json({error: "Unexpected error happened"})
    }
}

exports.createWebhook = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
        // this token will be supabase auth token
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({error: "Not authorized"});
        };

        // get user info (user_id)
        const user = await verifyToken(token);
        if (!user && !user?.sub) {
            return res.status(401).json({ error: "Not authorized" });
        };

        const profileId = user.sub
        const { webhookUrl, env } = req.body
        // filed validation
        if (!webhookUrl || !env) return res.status(400).json({error: "webhookUrl and env is required"})
        
        if (env == "production"){
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
            const {data: profile, error: profileError} = await supabaseCall(() => supabase
                .from("profiles")
                .select("prod_enabled")
                .eq("id", profileId)
                .maybeSingle())
            if (profileError) throw profileError
            if (!profile.prod_enabled) return res.status(401).json({error: "Please contact HIFI for activating production environment"})
        }

        // dev spin up sandbox profile if not yet exist
        if (env == "sandbox"){
            const supabase = createClient(process.env.SUPABASE_SANDBOX_URL, process.env.SUPABASE_SANDBOX_SERVICE_ROLE_KEY)
            const {data: sandboxProfile, error: sandboxProfileError} = await supabaseCall(() => supabase
                .from("profiles")
                .select("id")
                .eq("id", profileId)
                .maybeSingle())
            
            if (sandboxProfileError) throw sandboxProfileError
            if (!sandboxProfile){
                // insert new profile
                const {data: newSandboxProfile, error: newSandboxProfileError} = await supabaseCall(() => supabase
                    .from("profiles")
                    .insert({
                        id: profileId
                    }))
                if (newSandboxProfileError) throw newSandboxProfileError
            }
        }

        const secretKey = await activateWebhook(webhookUrl, profileId, env)
        const result = {
            webhookUrl,
            secretKey
        }
        return res.status(200).json(result)

    }catch (error){
        console.error(error)
        createLog("auth/createWebhookUrl", "", error.message, error)
        return res.status(500).json({error: "Internal server error"})
    }
}