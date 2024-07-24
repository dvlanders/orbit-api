const { isUUID } = require("../common/fieldsValidation");
const createLog = require("../logger/supabaseLogger");
const supabase = require("../supabaseClient");
const { supabaseCall } = require("../supabaseWithRetry");

const checkSignedAgreementId = async(signedAgreementId) => {
    const {data, error} = await supabaseCall(() => supabase
    .from("signed_agreements")
    .select()
    .eq("id", signedAgreementId)
    )

    if (error){
        await createLog("user/util/checkSignedAgreementId", null, error.message, error)
        throw error
    }

    if (data && data.length > 0){
        // expired
        if (new Date(data[0].expired_at) < new Date()) return {isValid: false, isExpired: true, data: null}
        // used
        if (data[0].signed) return {isValid: false, isExpired: false, data: null}
        return {isValid: true, isExpired: false, data: data[0]}
    }

    return {isValid: true, isExpired: false, data: null}
}

const checkIsSignedAgreementIdSigned = async(signedAgreementId) => {
    if (!isUUID(signedAgreementId)) return false
    const {data, error} = await supabaseCall(() => supabase
    .from("signed_agreements")
    .select()
    .eq("id", signedAgreementId)
    .maybeSingle()
    )

    if (error){
        await createLog("user/util/checkIsSignedAgreementIdSigned", null, error.message, error)
        throw error
    }

    if (!data) return false
    if (!data.signed) return false

    // check if signedAgreementId is used
    const { data: userKyc, error: userKycError } = await supabaseCall( () =>  supabase
        .from('user_kyc')
        .select('id, user_id')
        .eq('signed_agreement_id', signedAgreementId)
    )
    if (userKycError){
        await createLog("user/util/checkIsSignedAgreementIdSigned", userKyc.user_id, userKycError.message, userKycError)
        throw error
    }
    if (userKyc && userKyc.length > 0) return false

    return true
}

const checkToSTemplate = async(templateId) => {

    let { data: tos_template, error } = await supabaseCall(() => supabase
    .from('tos_template')
    .select('*')
    .eq("id", templateId)
    .maybeSingle()
    )

    if (error) {
        await createLog("user/util/checkToSTemplate", null, error.message, error, tos_template.profile_id)
        throw error
    }

    if (!tos_template) return false
    return true
        
}

const generateNewSignedAgreementRecord = async(signedAgreementId, templateId) => {
    const currentTime = new Date().getTime();
    const updatedTIme = new Date(currentTime +60 * 60 * 1000);
    const {data, error} = await supabaseCall(() => supabase
    .from("signed_agreements")
    .insert({
        id: signedAgreementId,
        expired_at: updatedTIme.toISOString(),
        template_id: templateId
    })
    .select()
    .single()
    )

    if (error){
        await createLog("user/util/generateNewSignedAgreementRecord", null, error.message, error)
        throw error
    }

    return data

}

const updateSignedAgreementRecord = async(sessionToken) => {
    const {data: record, error: recordError} = await supabaseCall(() => supabase
    .from("signed_agreements")
    .select()
    .eq("session_token", sessionToken)
    .maybeSingle()
    )

    if (recordError) {
        await createLog("user/util/updateSignedAgreementRecord", null, recordError.message, recordError)
        throw recordError
    }
    // session token not found
    if (!record) return null
    // token expired
    if (new Date(record.expired_at) < new Date()) return null
    // already signed
    if (record.signed) return null

    // updated to signed
    const {data: updatedRecord, error: updatedRecordError} = await supabaseCall(() => supabase
        .from("signed_agreements")
        .update({signed: true})
        .eq("session_token", sessionToken)
        .select()
        .single()
    )

    if (updatedRecordError) {
        await createLog("user/util/updateSignedAgreementRecord", null, updatedRecordError.message, updatedRecordError)
        throw updatedRecordError
    }

    return updatedRecord.id
}

module.exports = {
    generateNewSignedAgreementRecord,
    updateSignedAgreementRecord,
    checkSignedAgreementId,
    checkToSTemplate,
    checkIsSignedAgreementIdSigned
}