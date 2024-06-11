const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const createAndFundBastionUser = require('../util/bastion/endpoints/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createCheckbookBankAccount } = require('../util/checkbook/endpoint/createCheckbookBankAccount')

exports.createUsdOnrampSourceWithPlaid = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { user_id, plaid_processor_token } = req.body;

	// TODO: implement createCheckbookBankAccount

	return res.status(200).json({ message: 'success' });

}
exports.createUsdOfframpDestination = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { user_id, currency, bank_name, account_owner_name, account_number, routing_number, beneficiary_street_line_1, beneficiary_street_line_2, beneficiary_city, beneficiary_state_code, beneficiary_postal_code, beneficiary_country_code } = req.body;

	if (!user_id || !currency || !bank_name || !account_owner_name || !account_number || !routing_number || !beneficiary_street_line_1 || !beneficiary_street_line_2 || !beneficiary_city || !beneficiary_state_code || !beneficiary_postal_code || !beneficiary_country_code) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	// TODO: implement createBridgeExternalAccount

}
exports.createEuroOfframpDestination = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { user_id, currency, bank_name, account_owner_name, account_number, business_identifier_code, country_code, first_name, last_name, business_name, address } = req.body;

	if (!user_id || !currency || !bank_name || !account_owner_name || !account_number || !business_identifier_code || !country_code || !first_name || !last_name || !business_name || !address) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	// TODO: implement createBridgeExternalAccount

}


