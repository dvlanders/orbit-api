const { createApiKeyFromProvider } = require("../../util/auth/createApiKey/createZuploApiKey")
const { getDashboardApiKeyFromZuplo } = require("../../util/auth/createApiKey/getRawApiKey")
const { fieldsValidation } = require("../../util/common/fieldsValidation")
const { symmetricEncryption } = require("../../util/common/symmetricEncryption")
const createLog = require("../../util/logger/supabaseLogger")
const supabaseSandbox = require("../../util/sandboxSupabaseClient")
const supabase = require("../../util/supabaseClient")
const crypto = require('crypto');
exports.onboard = async (req, res) => {
    const { profileId, originProfileId } = req.query
    const fields = req.body
    try{
        const requiredFields = ["lastName", "firstName", "contactEmail", "userName"]
        const acceptedFields = {
            lastName: "string",
            firstName: "string",
            contactEmail: "string",
            userName: "string",
            organizationName: "string",
            organizationSite: "string",
        }
        
        const { missingFields, invalidFields } = fieldsValidation(fields, requiredFields, acceptedFields)
        if (missingFields.length > 0 || invalidFields.length > 0) {
            return res.status(400).json({ error: `fields provided are either missing or invalid`, missingFields: missingFields, invalidFields: invalidFields })
        }

        // avoid update company name and site if profileId != originProfileId
        if (profileId !== originProfileId) {
            fields.organizationName = null
            fields.organizationSite = null
        }
        
        const {lastName, firstName, contactEmail, userName, organizationName, organizationSite} = fields
        const supabaseProdClient = supabase
        const supabaseSandboxClient = supabaseSandbox
        // update user in production supabase
        const {data: userData, error: userError} = await supabaseProdClient.from("profiles")
            .update({
                last_name: lastName,
                first_name: firstName,
                contact_email: contactEmail,
                username: userName,
                organization_name: organizationName || `${firstName} ${lastName}'s Organization`,
                website: organizationSite || null,
                onboarded: true,
            })
            .eq("id", originProfileId)
            .select("*")
            .single()

        if (userError) throw userError
        if (!userData) throw new Error("User not found")

        // update user in sandbox supabase
        const {data: sandboxUserData, error: sandboxUserError} = await supabaseSandboxClient
            .from("profiles")
            .upsert(userData, {onConflict: "id"})
            .select("*")
            .single()

        if (sandboxUserError) throw sandboxUserError
        if (!sandboxUserData) throw new Error("User not found")

        // create sandbox api key for the user
        await createApiKeyFromProvider(originProfileId, "dashboardApiKey", new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), "sandbox", true)

        return res.status(200).json({message: "User onboarded successfully"})

    }catch(error){
        await createLog("dashboard/auth/onboard", null, error.message, null, profileId)
        return res.status(500).json({error: "Internal server error"})
    }
}

exports.retrieveEncryptedApiKey = async (req, res) => {
    const {profileId} = req.query
    try{
        // get the raw api key
        const [sandboxApiKey, productionApiKey] = await Promise.all([
            getDashboardApiKeyFromZuplo(profileId, "sandbox"), 
            getDashboardApiKeyFromZuplo(profileId, "production")
        ])

        if (!sandboxApiKey) {
            await createLog("dashboard/auth/retrieveEncryptedApiKey", null, "sandbox api key not found", null, profileId)
        }

        // encrypt the api key
        const encryptedApiKeys = {}
        const key = Buffer.from(process.env.DASHBOARD_API_KEY_ENCRYPTION_KEY, 'hex') // Key length: 256 bits
        const iv = crypto.randomBytes(12); // Initialization vector length: 96 bits
        if (sandboxApiKey) {
            encryptedApiKeys.sandbox = symmetricEncryption(key, iv, sandboxApiKey)
        }
        if (productionApiKey) {
            encryptedApiKeys.production = symmetricEncryption(key, iv, productionApiKey)
        }

        return res.status(200).json({encryptedApiKeys})

    }catch(error){
        await createLog("dashboard/auth/retrieveEncryptedApiKey", null, error.message, null, profileId)
        return res.status(500).json({error: "Internal server error"})
    }

}