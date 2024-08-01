
const ACCOUNT_NAME = process.env.ZUPLO_ACCOUNT_NAME
const KEY_BUCKET_NAME = process.env.ZUPLO_KEY_BUCKET_NAME
const SANDBOX_KEY_BUCKET_NAME = process.env.ZUPLO_SANDBOX_KEY_BUCKET_NAME
const API_KEY = process.env.ZUPLO_API_KEY


exports.deleteZuploApiKey = async(apiKeyId, env) => {
    
    let url
    if (env == "sandbox"){
      url = `https://dev.zuplo.com/v1/accounts/${ACCOUNT_NAME}/key-buckets/${SANDBOX_KEY_BUCKET_NAME}/consumers/${apiKeyId}`
    }else if (env == "production"){
      url = `https://dev.zuplo.com/v1/accounts/${ACCOUNT_NAME}/key-buckets/${KEY_BUCKET_NAME}/consumers/${apiKeyId}`
    }else {
      throw new Error(`Invalid env: ${env}`)
    }

    options = {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${API_KEY}`
        },
    }

    const response = await fetch(url, options)
    if (!response.ok) throw new Error(`Error when getting response from Zuplo api key deletion, ${JSON.stringify(responseBody)}`)
 
}