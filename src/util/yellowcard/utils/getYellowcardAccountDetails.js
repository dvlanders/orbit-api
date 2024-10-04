const createLog = require('../../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../../util/supabaseWithRetry');
const supabase = require('../../../util/supabaseClient');


const getYellowcardAccountDetails = async (destinationAccountId) => {

	// get the account_providers details
	const { data: accountProviderRecord, error: accountProviderRecordError } = await supabaseCall(() => supabase
		.from('account_providers')
		.select('*')
		.eq('id', destinationAccountId)
		.maybeSingle()

	)

	if (accountProviderRecordError) {
		createLog('error', accountProviderRecordError)
		throw new Error('Error fetching account provider details')
	}



	// find the account details on the right table based on the rail
	if (accountProviderRecord.payment_rail === 'momo_mpesa') {
		const { data: momoMpesaAccountRecord, error: momoMpesaAccountRecordError } = await supabaseCall(() => supabase
			.from('yellowcard_momo_mpesa_accounts')
			.select('*')
			.eq('id', accountProviderRecord.account_id)
			.maybeSingle()

		)
		if (momoMpesaAccountRecordError) {
			createLog('error', momoMpesaAccountRecordError)
			throw new Error('Error fetching account provider details')
		}
		return { payoutAccountDetails: momoMpesaAccountRecord }
	}

	// no account found so return error	
	throw new Error('No account found for the account provider')
}


module.exports = {
	getYellowcardAccountDetails
}