const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { astra } = require('.');
const cron = require('node-cron');


const CHECKBOOK_URL = process.env.CHECKBOOK_URL;
const CHECKBOOK_CLIENT_ID = process.env.CHECKBOOK_CLIENT_ID;
const CHECKBOOK_API_KEY = process.env.CHECKBOOK_API_KEY;
const CHECKBOOK_API_SECRET = process.env.CHECKBOOK_API_SECRET;


/**
 * Create a new Checkbook user
 */
exports.createCheckbookUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, name } = req.body;

	if (!merchantId || !name) {
		return res.status(400).json({ error: 'merchantId and name are required' });
	}

	const url = `${CHECKBOOK_URL}/user`;
	const body = {
		"name": name,
		"user_id": merchantId
	}

	const options = {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Authorization': `${CHECKBOOK_API_KEY}:${CHECKBOOK_API_SECRET}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	try {
		const response = await fetch(url, options);
		console.log('response', response);
		const data = await response.json();

		console.log('data', data);

		if (!response.ok) {
			console.error(`Error while creating Checkbook user for mechantId ${merchantId}: ${JSON.stringify(data)}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while exchanging auth code: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/create_user',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: checkbookUserData, error: checkbookUserError } = await supabase
			.from('checkbook_users')
			.insert({
				checkbook_id: merchantId,
				checkbook_key: data.key,
				checkbook_secret: data.secret,
				checkbook_name: name,
				merchant_id: merchantId,
			});

		if (checkbookUserError) {
			console.error(`Error while creating Checkbook user record in db: ${checkbookUserError}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while creating Checkbook user record in db: ${checkbookUserError}`,
					status: 500,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/create_user db write operation',
				})

			return res.status(500).json({
				error: JSON.stringify(checkbookUserError),
			});
		}

		return res.json(data);
	} catch (error) {
		console.error(`Error while creating Checkbook user: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while creating Checkbook user: ${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /checkbook/create_user',
			})

		console.log('logData', logData);
		console.log('logError', logError);

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};

/**
 * Create a new Checkbook bank account with plaid processor token
 */
exports.createCheckbookBankAccountWithProcessorToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, plaidAccountId } = req.body;

	if (!merchantId || !plaidAccountId) {
		return res.status(400).json({ error: 'merchantId and plaidAccountId are required' });
	}

	const { data: checkbookUserData, error: checkbookUserError } = await supabase
		.from('checkbook_users')
		.select('*')
		.eq('merchant_id', merchantId)
		.single();

	if (checkbookUserError) {
		console.error(`Error while fetching Checkbook user data: ${JSON.stringify(checkbookUserError)}`);
		throw new Error(`${JSON.stringify(checkbookUserError)}`);
	}

	console.log('checkbookUserData', checkbookUserData);


	const { data: plaidAccountData, error: plaidAccountError } = await supabase
		.from('plaid_accounts')
		.select('*')
		.eq('account_id', plaidAccountId)
		.single();

	if (plaidAccountError) {
		throw new Error(`${JSON.stringify(plaidAccountError)}`);
	}

	console.log('plaidAccountData', plaidAccountData);

	const url = `${CHECKBOOK_URL}/account/bank/iav/plaid`;
	const body = {
		"processor_token": plaidAccountData.processor_token,
	}

	const options = {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Authorization': `${checkbookUserData.checkbook_key}:${checkbookUserData.checkbook_secret}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	console.log('options', options);

	try {
		const response = await fetch(url, options);
		console.log('response', response);
		const data = await response.json();

		console.log('data', data);

		if (!response.ok) {
			console.error(`Error while creating Checkbook bank account for mechantId ${merchantId}: ${JSON.stringify(data)}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/account/plaid',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: checkbookAccountData, error: checkbookAccountError } = await supabase
			.from('checkbook_accounts')
			.insert({
				plaid_processor_token: plaidAccountData.processor_token,
				plaid_account_id: plaidAccountId,
				merchant_id: merchantId,
				checkbook_response: data,
			});

		if (checkbookAccountError) {
			console.error(`Error while creating Checkbook account record in db: ${checkbookAccountError}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${checkbookAccountError}`,
					status: 500,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/account/plaid',
				})

			return res.status(500).json({
				error: JSON.stringify(checkbookAccountError),
			});
		}

		return res.json(data);
	} catch (error) {
		console.error(`Error while creating Checkbook account: ${JSON.stringify(error)}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while creating Checkbook account with plaid: ${error.toString()}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /checkbook/account/plaid',
			})

		console.log('logData', logData);
		console.log('logError', logError);

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};



/**
 * Create a new Checkbook bank account for the user's bridge virtual account
 */
exports.createCheckbookAccountForBridgeVirtualAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;

	if (!merchantId) {
		return res.status(400).json({ error: 'merchantId is required' });
	}

	const { data: checkbookUserData, error: checkbookUserError } = await supabase
		.from('checkbook_users')
		.select('*')
		.eq('merchant_id', merchantId)
		.single();

	if (checkbookUserError) {
		console.error(`Error while fetching Checkbook user data: ${JSON.stringify(checkbookUserError)}`);
		throw new Error(`${JSON.stringify(checkbookUserError)}`);
	}

	console.log('checkbookUserData', checkbookUserData);

	const { data: bridgeVirtualAccountData, error: bridgeVirtualAccountError } = await supabase
		.from('bridge_virtual_accounts')
		.select('*')
		.eq('merchant_id', merchantId)
		.single();

	if (bridgeVirtualAccountError) {
		console.error(`${JSON.stringify(bridgeVirtualAccountError)}`);
		throw new Error(`${JSON.stringify(bridgeVirtualAccountError)}`);
	}

	console.log('bridgeVirtualAccountData', bridgeVirtualAccountData);

	const url = `${CHECKBOOK_URL}/account/bank`;
	const body = {
		"account": bridgeVirtualAccountData.deposit_instructions_bank_account_number,
		"routing": bridgeVirtualAccountData.deposit_instructions_bank_routing_number,
		"type": "CHECKING",
	}

	const options = {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Authorization': `${checkbookUserData.checkbook_key}:${checkbookUserData.checkbook_secret}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	console.log('options', options);

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		console.log('data', data);

		if (!response.ok) {
			console.error(`Error while creating Checkbook bank account for mechantId ${merchantId}: ${JSON.stringify(data)}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/account/bridge_virtual_account',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: checkbookAccountData, error: checkbookAccountError } = await supabase
			.from('checkbook_accounts')
			.insert({
				account_type: "CHECKING",
				merchant_id: merchantId,
				account_number: bridgeVirtualAccountData.deposit_instructions_bank_account_number,
				routing_number: bridgeVirtualAccountData.deposit_instructions_bank_routing_number,
				bridge_virtual_account_id: bridgeVirtualAccountData.id,
				checkbook_response: data,
			});

		if (checkbookAccountError) {
			console.error(`Error while creating Checkbook account record in db: ${checkbookAccountError}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${checkbookAccountError}`,
					status: 500,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/account/bridge_virtual_account',
				})

			return res.status(500).json({
				error: JSON.stringify(checkbookAccountError),
			});
		}

		return res.json(data);
	} catch (error) {
		console.error(`Error while creating Checkbook account: ${JSON.stringify(error)}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while creating Checkbook account with plaid: ${error.toString()}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /checkbook/account/bridge_virtual_account',
			})

		console.log('logData', logData);
		console.log('logError', logError);

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};
