const { fieldsValidation } = require("../../util/common/fieldsValidation")
const createLog = require("../../util/logger/supabaseLogger")
const supabaseSandbox = require("../../util/sandboxSupabaseClient")
const supabase = require("../../util/supabaseClient")

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

        return res.status(200).json({message: "User onboarded successfully"})

    }catch(error){
        await createLog("dashboard/auth/onboard", null, error.message, null, profileId)
        return res.status(500).json({error: "Internal server error"})
    }
}