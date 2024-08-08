const createLog = require("../../util/logger/supabaseLogger")
const supabaseSandbox = require("../../util/sandboxSupabaseClient")
const supabase = require("../../util/supabaseClient")

exports.getAllWebhookHistory = async(req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const {profileId, env, type, limit, createdAfter, createdBefore} = req.query
    try {
        // check env
        let supabaseClient
        if (env == "production") {
            supabaseClient = supabase
        }else if (env == "sandbox") {
            supabaseClient = supabaseSandbox
        }else{
            return res.status(400).json({ error: 'env not allowed' })
        }

        let records = []
        const recordAfter = createdAfter || new Date("1900-01-01").toISOString()
        const recordBefore = createdBefore || new Date("2200-01-01").toISOString()
        const recordLimit = limit || 15
        if (type == "all"){
            const {data, error} = await supabaseClient
                .from("webhook_history")
                .select("*")
                .gt("created_at", recordAfter)
                .lt("created_at", recordBefore)
                .eq("profile_id", profileId)
                .order("created_at", {ascending: false})
                .limit(recordLimit)
            if (error) throw error
            records = data
        }else if (type == "succeeded"){
            const {data, error} = await supabaseClient
                .from("webhook_history")
                .select("*")
                .gt("client_response_status_code", 199)
                .lt("client_response_status_code", 300)
                .eq("profile_id", profileId)
                .order("created_at", {ascending: false})
                .limit(recordLimit)
            if (error) throw error
            records = data
        }else if (type == "failed"){
            const {data, error} = await supabaseClient
                .from("webhook_history")
                .select("*")
                .or('client_response_status_code.gt.299,client_response_status_code.lt.200')
                .eq("profile_id", profileId)
                .order("created_at", {ascending: false})
                .limit(recordLimit)
            
            if (error) throw error
            records = data
        }else if (type == "queued"){
            const {data, error} = await supabaseClient
                .from("webhook_queue")
                .select("*")
                .eq("profile_id", profileId)
                .order("created_at", {ascending: false})
                .limit(recordLimit)
            
            if (error) throw error
            records = data
        }

        records = records.map((record) => {
            return {
                id: record.id,
                clientResponse: record.client_response,
                createdAt: record.created_at,
                clientResponseStatusCode: record.client_response_status_code,
                profileId: record.profile_id,
                requestBody: record.request_body,
                nextRetry: record.next_retry,
                firstRetry: record.first_retry
            }
        })

        return res.status(200).json({records: records})

    }catch (error){
        await createLog("dahsboard/getAllWebhookHistory", null, error.message, error, profileId)
        return res.status(500).json({error: "Internal server error"})
    }
}