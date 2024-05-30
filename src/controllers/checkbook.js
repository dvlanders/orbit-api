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
				checkbook_user_id: merchantId,
				checkbook_id: data.id,
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

	try {
		// Fetch user and Plaid account data from database
		const { data: checkbookUserData, error: checkbookUserError } = await supabase
			.from('checkbook_users')
			.select('*')
			.eq('merchant_id', merchantId)
			.single();
		if (checkbookUserError) {
			throw new Error(`Error fetching Checkbook user data: ${JSON.stringify(checkbookUserError)}`);
		}

		const { data: plaidAccountData, error: plaidAccountError } = await supabase
			.from('plaid_accounts')
			.select('*')
			.eq('account_id', plaidAccountId)
			.single();
		if (plaidAccountError) {
			throw new Error(`Error fetching Plaid account data: ${JSON.stringify(plaidAccountError)}`);
		}

		// Add Plaid processor token to Checkbook and receive account details
		const plaidResponse = await fetch(`${CHECKBOOK_URL}/account/bank/iav/plaid`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUserData.checkbook_key}:${checkbookUserData.checkbook_secret}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ "processor_token": plaidAccountData.processor_token })
		});
		const plaidData = await plaidResponse.json();

		if (!plaidResponse.ok) {
			throw new Error(`Error adding Plaid processor token: ${JSON.stringify(plaidData)}`);
		}
		console.log('plaidData', plaidData);
		const { account, routing, name } = plaidData.accounts[0];

		if (!account || !routing) {
			throw new Error(`Error adding Plaid processor token: the returned account's account or routing is null`);
		}

		const accountType = plaidAccountData.subtype === "checking" ? "CHECKING" : plaidAccountData.subtype === "savings" ? "SAVINGS" : plaidAccountData.subtype === "business" ? "BUSINESS" : "CHECKING";

		const bankResponse = await fetch(`${CHECKBOOK_URL}/account/bank`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUserData.checkbook_key}:${checkbookUserData.checkbook_secret}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				account: account,
				name: name,
				routing: routing,
				type: accountType
			})
		});
		const bankData = await bankResponse.json();

		if (!bankResponse.ok) {
			throw new Error(`Error adding bank account details: ${JSON.stringify(bankData)}`);
		}

		const { data: checkbookAccountData, error: checkbookAccountError } = await supabase
			.from('checkbook_accounts')
			.insert({
				plaid_processor_token: plaidAccountData.processor_token,
				plaid_account_id: plaidAccountId,
				merchant_id: merchantId,
				checkbook_response: bankData,
				account_type: accountType,
				account_number: bankData.account,
				routing_number: bankData.routing,
				checkbook_id: bankData.id,
			});


		// Response with the bank account creation data
		return res.json(bankData);
	} catch (error) {
		console.error(`Error while creating Checkbook bank account with Plaid processor token: ${error}`);
		return res.status(500).json({
			error: `Internal Server Error: ${error.message}`,
			details: error.details || ''
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
	const { merchantId, bridgeVirtualAccountId } = req.body;

	if (!merchantId || !bridgeVirtualAccountId) {
		return res.status(400).json({ error: 'merchantId and bridgeVirtualAccountId are required' });
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
		.eq('id', bridgeVirtualAccountId)
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
				checkbook_id: data.id,
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

/**
 * Create a new Checkbook digital payment and then deposit that payment (into the user's bridge virtual account)
 */
exports.executeCheckbookPullTransaction = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, amount, sourceCheckbookAccountId, destinationCheckbookAccountId } = req.body;

	if (!merchantId || !amount || !sourceCheckbookAccountId || !bridgeVirtualAccountId) {
		return res.status(400).json({ error: 'merchantId, amount, bridgeVirtualAccountId, and sourceCheckbookAccountId are required' });
	}

	// get the checkbook user for the key and secret to be passed in the future checkbook api request headers
	const { data: checkbookUserData, error: checkbookUserError } = await supabase
		.from('checkbook_users')
		.select('*')
		.eq('merchant_id', merchantId)
		.single();

	if (checkbookUserError) {
		console.error(`Error while fetching Checkbook user data: ${JSON.stringify(checkbookUserError)}`);
		throw new Error(`${JSON.stringify(checkbookUserError)}`);
	}


	// get the checkbook account associated with the plaid account where the funds are to be pulled from
	const { data: sourceAccountData, error: sourceAccountError } = await supabase
		.from('checkbook_accounts')
		.select('*')
		.eq('id', sourceCheckbookAccountId)
		.single();

	if (sourceAccountError) {
		console.error(`${JSON.stringify(sourceAccountError)}`);
		throw new Error(`${JSON.stringify(sourceAccountError)}`);
	}


	// get the checkbook account associated with the bridge virtual account where the funds are to be deposited
	const { data: destintionAccountData, error: destintionAccountError } = await supabase
		.from('checkbook_accounts')
		.select('*')
		.eq('id', destinationCheckbookAccountId)
		.single();

	if (destintionAccountError) {
		console.error(`${JSON.stringify(destintionAccountError)}`);
		throw new Error(`${JSON.stringify(destintionAccountError)}`);
	}

	const createDigitalPaymentUrl = `${CHECKBOOK_URL}/check/digital`;

	const recipientObject = {
		"account": destintionAccountData.account_number,
		"id": checkbookUserData.checkbook_id,
	}

	const body = {
		"account": sourceAccountData.checkbook_id,
		"amount": amount,
		"name": `${merchantId} deposit account`,
		"recipient": recipientObject
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
		const response = await fetch(createDigitalPaymentUrl, options);
		const data = await response.json();

		console.log('data', data);

		if (!response.ok) {
			console.error(`Error while creating digital check for ${merchantId}: ${JSON.stringify(data)}`);
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /checkbook/execute_pull_transaction',
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
					endpoint: 'POST /checkbook/execute_pull_transaction',
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
				endpoint: 'POST /checkbook/execute_pull_transaction',
			})

		console.log('logData', logData);
		console.log('logError', logError);

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};
