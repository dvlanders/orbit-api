const createLog = require('../../../util/logger/supabaseLogger');
const { supabaseCall } = require('../../../util/supabaseWithRetry');
const supabase = require('../../../util/supabaseClient');

const paymentRailTableMap = {
  momo_kes: 'yellowcard_momo_kes_accounts',
  momo_xof: 'yellowcard_momo_xof_accounts',
  momo_rwf: 'yellowcard_momo_rwf_accounts',
  momo_zmw: 'yellowcard_momo_zmw_accounts',
  bank_ngn: 'yellowcard_bank_ngn_accounts',
  bank_ugx: 'yellowcard_bank_ugx_accounts',
  bank_tzs: 'yellowcard_bank_tzs_accounts',
  bank_mwk: 'yellowcard_bank_mwk_accounts',
  bank_xaf: 'yellowcard_bank_xaf_accounts',
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