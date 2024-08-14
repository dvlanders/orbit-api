const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const { insertApiKeyRecord } = require("./insertApiKeyRecord");
const { v4: uuidv4 } = require("uuid");

const ACCOUNT_NAME = process.env.ZUPLO_ACCOUNT_NAME
const KEY_BUCKET_NAME = process.env.ZUPLO_KEY_BUCKET_NAME
const SANDBOX_KEY_BUCKET_NAME = process.env.ZUPLO_SANDBOX_KEY_BUCKET_NAME
const API_KEY = process.env.ZUPLO_API_KEY


exports.createApiKeyFromProvider = async (profileId, apiKeyName, expiredAt, env) => {

	const uuid = uuidv4()

	const keyConfig = {
		name: uuid,
		description: `api key for ${profileId}`,
		metadata: {
			profileId: profileId,
			apikeyId: uuid
		},
		tags: {
			profileId: profileId,
			name: uuid,
			userCustomName: apiKeyName
		}
	}
	let url
	if (env == "sandbox") {
		url = `https://dev.zuplo.com/v1/accounts/${ACCOUNT_NAME}/key-buckets/${SANDBOX_KEY_BUCKET_NAME}/consumers?with-api-key=true`
	} else if (env == "production") {
		url = `https://dev.zuplo.com/v1/accounts/${ACCOUNT_NAME}/key-buckets/${KEY_BUCKET_NAME}/consumers?with-api-key=true`
	} else {
		throw new Error(`Invalid env: ${env}`)
	}

	options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${API_KEY}`
		},
		body: JSON.stringify(keyConfig)
	}

	const response = await fetch(url, options)
	const responseBody = await response.json()
	if (!response.ok) throw new Error(`Error when getting response from Zuplo api key creation, ${JSON.stringify(responseBody)}`)
	const apiKeyInfo = {
		expiredAt: new Date(expiredAt).toISOString(),
		userCustomName: apiKeyName,
		id: uuid,
		profileId,
		zuploApiKeyId: responseBody.apiKeys[0].id,
		zuploCustomerId: responseBody.id,
	}

	const apiKeyRecord = await insertApiKeyRecord(apiKeyInfo, env)
	const record = {
		apiKeyName: apiKeyRecord.user_custom_name,
		createdAt: apiKeyRecord.created_at,
		expiredAt: apiKeyRecord.expired_at,
		active: apiKeyRecord.active,
		apiKey: responseBody.apiKeys[0].key
	}

	return record

}