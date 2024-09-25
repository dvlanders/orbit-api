const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchFiatToFiatRequestInfortmaionById = async (id, profileId) => {
	let { data: request, error: requestError } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.select('*, source_user: source_user_id!inner(profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email))')
		.eq("id", id)
		.eq("source_user.profile_id", profileId)
		.maybeSingle())


	if (requestError) throw requestError
	if (!request) return null

	return request
}

const fetchFiatToFiatRequestInfortmaionByRequestId = async (requestId) => {
	let { data: request, error: requestError } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.select('*')
		.eq("request_id", requestId)
		.maybeSingle())

	if (requestError) throw requestError
	if (!request) return null

	return request
}

const updateFiatToFiatRecordByRequestId = async (requestId, toUpdate) => {

    const { data, error } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.update({ 
			...toUpdate,
			updated_at: new Date().toISOString(),
		},)
		.eq('request_id', requestId)
		.select("*")
		.single()
    )

    if (error) throw error
    return data
        
}

const updateFiatToFiatRecordById = async (id, toUpdate) => {

    const { data, error } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.update({ 
			...toUpdate,
			updated_at: new Date().toISOString(),
		},)
		.eq('id', id)
		.select("*")
		.single()
    )

    if (error) throw error
    return data
        
}

const checkIsFiatToFiatRequestIdAlreadyUsed = async (requestId) => {
	let { data: newRecord, error: insertError } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.upsert({
			request_id: requestId,
		}, { onConflict: "request_id", ignoreDuplicates: true })
		.select("*")
		.maybeSingle())

	if (insertError) throw insertError

	return { isAlreadyUsed: !newRecord, newRecord: newRecord }
}

const fetchFiatToFiatProvidersInformationById = async(id) => {

    const { data: record, error:recordError } = await supabaseCall(() => supabase
        .from('fiat_to_fiat_transactions')
        .select('fiat_provider, fiat_receiver')
        .eq("id", id)
        .maybeSingle());

    if (recordError) throw recordError;
    return {fiatProvider: record?.fiat_provider, fiatReceiver: record?.fiat_receiver};
}

module.exports = {
    fetchFiatToFiatRequestInfortmaionById,
    fetchFiatToFiatRequestInfortmaionByRequestId,
	updateFiatToFiatRecordByRequestId,
	checkIsFiatToFiatRequestIdAlreadyUsed,
	fetchFiatToFiatProvidersInformationById,
	updateFiatToFiatRecordById
}