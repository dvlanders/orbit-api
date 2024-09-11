const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");

const fetchFiatToCryptoRequestInfortmaionById = async (id, profileId) => {
	let { data: request, error: requestError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('*, source_user: user_id!inner(profile_id, user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), destination_user: destination_user_id(user_kyc(legal_first_name, legal_last_name, business_name, compliance_email)), developer_fees: developer_fee_id(id, fee_type, fee_amount, fee_percent, charged_status, transaction_hash, failed_reason)')
		.eq("id", id)
		.eq("source_user.profile_id", profileId)
		.maybeSingle())


	if (requestError) throw requestError
	if (!request) return null

	return request
}

const fetchFiatToCryptoRequestInfortmaionByRequestId = async (requestId) => {
	let { data: request, error: requestError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.select('*')
		.eq("request_id", requestId)
		.maybeSingle())



	if (requestError) throw requestError
	if (!request) return null

	return request
}

const checkIsFiatToCryptoRequestIdAlreadyUsed = async (requestId, userId) => {
	let { data: newRecord, error: insertError } = await supabaseCall(() => supabase
		.from('onramp_transactions')
		.upsert({
			request_id: requestId,
		}, { onConflict: "request_id", ignoreDuplicates: true })
		.select("*")
		.maybeSingle())


	// record already exists
	if (insertError) throw insertError

	// new record
	return { isAlreadyUsed: !newRecord, newRecord: newRecord }
}

const checkIsFiatToFiatRequestIdAlreadyUsed = async (requestId, userId, accountNumber, routingNumber, recipientName, type, sourceAccountId, amount, currency, memo) => {
	let { data: newRecord, error: insertError } = await supabaseCall(() => supabase
		.from('fiat_to_fiat_transactions')
		.upsert({
			request_id: requestId,
			account_number: accountNumber,
			source_user_id: userId,
			routing_number: routingNumber,
			recipient_name: recipientName,
			type: type,
			amount: amount,
			currency: currency,
			memo: memo,
		}, { onConflict: "request_id", ignoreDuplicates: true })
		.select("*")
		.maybeSingle())


	// record already exists
	if (insertError) throw insertError

	// new record
	return { isAlreadyUsed: !newRecord, newRecord: newRecord }
}

const fetchFiatToCryptoProvidersInformationById = async(id) => {

    const { data: record, error:recordError } = await supabaseCall(() => supabase
        .from('onramp_transactions')
        .select('fiat_provider, crypto_provider')
        .eq("id", id)
        .maybeSingle());

    if (recordError) throw recordError;
    return {fiatProvider: record?.fiat_provider, cryptoProvider: record?.crypto_provider};
}

module.exports = {
    fetchFiatToCryptoRequestInfortmaionById,
    fetchFiatToCryptoRequestInfortmaionByRequestId,
    checkIsFiatToCryptoRequestIdAlreadyUsed,
	checkIsFiatToFiatRequestIdAlreadyUsed,
    fetchFiatToCryptoProvidersInformationById
}