const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

const submitKycData = async(userId) => {
    // fetch user info
    const { data: userKyc, error: userKycError } = await supabaseCall(() => supabase
    .from("user_kyc")
    .select('legal_first_name, legal_last_name, ip_address, date_of_birth')
    .eq("user_id", userId)
    .maybeSingle()
    )

    if (userKycError) throw new submitBastionKycError(submitBastionKycErrorType.INTERNAL_ERROR, userKycError.message, userKycError)
    if (!userKyc) throw new submitBastionKycError(submitBastionKycErrorType.RECORD_NOT_FOUND, "user not found")

    const birthDate = userKyc.date_of_birth ? new Date(userKyc.date_of_birth) : undefined;
    const formattedBirthDate = `${birthDate.getUTCFullYear()}-${(birthDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${birthDate.getUTCDate().toString().padStart(2, '0')}`;

    const requestBody = {
        firstName: userKyc.legal_first_name,
        lastName: userKyc.legal_last_name,
        dateOfBirth: formattedBirthDate,
        ipAddress: userKyc.ip_address
    };

    const url = `${BASTION_URL}/v1/users/${userId}/kyc`;
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${BASTION_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    };

    const response = await fetch(url, options);
    return response
}


module.exports = {
    submitKycData
}