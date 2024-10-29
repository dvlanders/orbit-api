const createLog = require("../../logger/supabaseLogger");
const supabaseSandbox = require("../../sandboxSupabaseClient");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const ACCOUNT_NAME = process.env.ZUPLO_ACCOUNT_NAME
const KEY_BUCKET_NAME = process.env.ZUPLO_KEY_BUCKET_NAME
const SANDBOX_KEY_BUCKET_NAME = process.env.ZUPLO_SANDBOX_KEY_BUCKET_NAME
const API_KEY = process.env.ZUPLO_API_KEY

const getDashboardApiKeyFromZuplo = async (profileId, env) => {

    if (!["sandbox", "production"].includes(env)) throw new Error(`Invalid env: ${env}`);

    let apiKeyId
    let supabaseClient
    if (env === "sandbox") {
        supabaseClient = supabaseSandbox
    } else if (env === "production") {
        supabaseClient = supabase
    }
    // get production api key id
    const { data: productionApiKey, error: productionApiKeyError } = await supabaseCall(() => supabaseClient
        .from("api_keys")
        .select("id")
        .eq("profile_id", profileId)
        .eq("is_dashboard_api_key", true)
        .eq("active", true)
        .limit(1)
    );
    if (productionApiKeyError) throw productionApiKeyError;
    if (productionApiKey.length === 0) return null;
    apiKeyId = productionApiKey[0].id;

    // get raw api key from zuplo
    let bucketName
	if (env == "sandbox") {
		bucketName = SANDBOX_KEY_BUCKET_NAME
	} else if (env == "production") {
		bucketName = KEY_BUCKET_NAME
	}
    const url = `https://dev.zuplo.com/v1/accounts/${ACCOUNT_NAME}/key-buckets/${bucketName}/consumers?include-api-keys=true&key-format=visible&tag.name=${apiKeyId}`
    options = {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${API_KEY}`
		}
	}

	const response = await fetch(url, options)
    const data = await safeJsonParse(response)
    if (!response.ok) {
        await createLog("auth/createApiKey/getRawApiKey", null, data.error || data.message, data, profileId)
        throw new Error("Error fetching api key from zuplo");
    }
    if (data.data.length === 0) throw new Error(`No api key found for profileId: ${profileId} with apiKeyId: ${apiKeyId} in ${env} environment`);

    const rawApiKey = data.data[0].apiKeys[0].key
    return rawApiKey
}

module.exports = {
    getDashboardApiKeyFromZuplo
}