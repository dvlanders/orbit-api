const createLog = require('../../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../../util/supabaseWithRetry');
const supabase = require('../../../util/supabaseClient');

const paymentRailTableMap = {
  momo_mpesa: 'yellowcard_momo_mpesa_accounts',
  nibss: 'yellowcard_nibss_bank_accounts',
  momo_mtn: 'yellowcard_momo_mtn_accounts',
}

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
	// TODO add more bank account types

  if (!paymentRailTableMap[accountProviderRecord.payment_rail]) throw new Error('No account found for the account provider')

  const { data: AccountRecord, error: AccountRecordError } = await supabaseCall(() => supabase
  .from(paymentRailTableMap[accountProviderRecord.payment_rail])
  .select('*')
  .eq('id', accountProviderRecord.account_id)
  .maybeSingle()
  )
  
  if (AccountRecordError) {
    createLog('error', AccountRecordError)
    throw new Error('Error fetching account provider details')
  }
  return { payoutAccountDetails: AccountRecord }
}


module.exports = {
	getYellowcardAccountDetails
}