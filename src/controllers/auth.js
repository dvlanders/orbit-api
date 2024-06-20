const { createApiKeyFromProvider } = require("../util/auth/createApiKey/createZuploApiKey");
const { fieldsValidation } = require("../util/common/fieldsValidation");
const { verifyToken } = require("../util/helper/verifyToken");
const createLog = require("../util/logger/supabaseLogger");

exports.createApiKey = async(req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try{
        // // this token will be supabase auth token
        // const token = req.headers.authorization?.split(" ")[1];
        // if (!token) {
        //     return res.status(401).json({error: "Not authorized"});
        // };

        // // get user info (user_id)
        // const user = await verifyToken(token);
        // if (!user && !user?.sub) {
        //     return res.status(401).json({ error: "Not authorized" });
        // };
        // const profileId = user.sub

        //DEV
        const profileId = "3b8be475-1b32-4ff3-9384-b6699c139869"

        // filed validation
        const fields = req.body
        const {missingFields, invalidFields} = fieldsValidation(fields, ["apiKeyName", "expiredAt"], {"apiKeyName": "string", "expiredAt": "string"})
        if (missingFields.length > 0 || invalidFields.length > 0) return res.status(400).json({ error: `fields provided are either missing or invalid`, missing_fields: missingFields, invalid_fields: invalidFields })

        // crearte an api key
        const { apiKeyName, expiredAt } = fields
        const apikeyInfo = await createApiKeyFromProvider(profileId, apiKeyName, expiredAt)
        return res.status(200).json(apikeyInfo)

    }catch (error){
        createLog("auth/createApiKey", "", error.message, error)
        return res.status(500).json({error: "Internal server error"})
    }

}