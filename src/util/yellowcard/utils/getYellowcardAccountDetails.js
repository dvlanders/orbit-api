const createLog = require('../../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../../util/supabaseWithRetry');
const supabase = require('../../../util/supabaseClient');


const getYellowcardAccountDetails = async (destinationAccountId) => {

	// get the account_providers details
	const { data: accountProviderRecord, error: accountProviderRecordError } = await supabaseCall(() => supabase
		.from('account_providers')
		.select('*')
		.eq('id', destinationAccountId)

	)

	if (accountProviderRecordError) {
		createLog('error', accountProviderRecordError)
		throw new Error('Error fetching account provider details')
	}

	console.log('accountProviderRecord', accountProviderRecord)



	// find the account details on the right table based on the account provider
	if (accountProviderRecord.provider === 'YELLOWCARD') {
		return await getYellowcardAccountDetails(destinationAccountId)
	}




	const { data: yellowcardAccountDetails, error: yellowcardAccountDetailsError } = await supabaseCall(() => supabase
		.from('yellowcard_accounts')
		.select('*')
		.eq('id', destinationAccountId)
		.single()
	)

	if (yellowcardAccountDetailsError) {
		createLog('error', yellowcardAccountDetailsError)
		throw new Error('Error fetching yellowcard account details')
	}

	return yellowcardAccountDetails
}


module.exports = {
	getYellowcardAccountDetails
}