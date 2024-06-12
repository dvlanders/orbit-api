const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const createAndFundBastionUser = require('../util/bastion/endpoints/createAndFundBastionUser');
const createLog = require('../util/logger/supabaseLogger');
const { createBridgeExternalAccount } = require('../util/bridge/endpoint/createBridgeExternalAccount')
const { createCheckbookBankAccount } = require('../util/checkbook/endpoint/createCheckbookBankAccount')


const Status = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	PENDING: "PENDING",
}

exports.createUsdOnrampSourceWithPlaid = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { user_id, plaid_processor_token } = req.body;

	const checkbookAccountResult = await createCheckbookBankAccount(user_id, plaid_processor_token);

	let createUsdOnrampSourceWithPlaidResponse = {
		status: null,
		invalidFields: [],
		message: null,
	}


	if (checkbookAccountResult.status == 200) {
		createUsdOnrampSourceWithPlaidResponse.status = Status.ACTIVE
		createUsdOnrampSourceWithPlaidResponse.id = checkbookAccountResult.id
		createUsdOnrampSourceWithPlaidResponse.message = "Account created successfully"

	} else if (checkbookAccountResult.status == 400) {
		createUsdOnrampSourceWithPlaidResponse.status = Status.INACTIVE
		createUsdOnrampSourceWithPlaidResponse.invalidFields = checkbookAccountResult.invalidFields
		createUsdOnrampSourceWithPlaidResponse.message = checkbookAccountResult.message
	} else {
		createUsdOnrampSourceWithPlaidResponse.status = Status.INACTIVE
		createUsdOnrampSourceWithPlaidResponse.invalidFields = checkbookAccountResult.invalidFields
		createUsdOnrampSourceWithPlaidResponse.message = checkbookAccountResult.message
	}

	let status

	if (checkbookAccountResult.status === 200) {
		status = 200
	} else if (checkbookAccountResult.status === 500) {
		status = 500;
	} else {
		status = 400;
	}



	return res.status(status).json(createUsdOnrampSourceWithPlaidResponse);

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

