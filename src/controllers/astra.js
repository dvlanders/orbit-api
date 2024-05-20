const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { astra } = require('.');
const cron = require('node-cron');


const ASTRA_URL = process.env.ASTRA_URL;
const ASTRA_CLIENT_ID = process.env.ASTRA_CLIENT_ID;
const ASTRA_CLIENT_SECRET = process.env.ASTRA_CLIENT_SECRET;
const ASTRA_CREDENTIALS = Buffer.from(`${ASTRA_CLIENT_ID}:${ASTRA_CLIENT_SECRET}`).toString('base64');
const ASTRA_SECURE_URL = process.env.ASTRA_SECURE_URL;

/**
 * Exchange the authorization code for an access token.
 */
exports.exchangeAuthCodeForAccessToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, authCode } = req.body;

	if (!merchantId || !authCode) {
		return res.status(400).json({ error: 'merchantId and authCode are required' });
	}

	const url = `${ASTRA_URL}/v1/oauth/token`;
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code: authCode,
		redirect_uri: 'https://portal.hifibridge.com/auth/astraRedirect', // redirect uri seems to require https so localhost wont work
	});

	const options = {
		method: 'POST',
		headers: {
			'accept': 'application/json',
			'authorization': `Basic ${ASTRA_CREDENTIALS}`,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while exchanging auth code: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /astra/oauth/token',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: tokenData, error: tokenError } = await supabase
			.from('astra_users')
			.insert({
				merchant_id: merchantId,
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				expires_in: data.expires_in,
				token_type: data.token_type,
				last_refresh_at: new Date()
			});

		return res.json(data);
	} catch (error) {
		console.error(`Error while exchanging auth code: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while exchanging auth code: ${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /astra/oauth/token',
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
 * Periodically refresh access tokens for all users where the token is older than the specified threshold.
 */
async function refreshAccessTokens() {
	try {
		// 5 day threshold for token age. Anything older gets refreshed.
		const thresholdTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

		const isoThresholdTime = thresholdTime.toISOString();

		// Fetch all users who need their access tokens refreshed
		const { data: users, error } = await supabase
			.from('astra_users')
			.select('*')
			.lte('last_refresh_at', isoThresholdTime);

		if (error) {
			logger.error(`Error fetching users needing token refresh: ${error.message}`);
			return;
		}

		for (const user of users) {
			await refreshAccessTokenForUser(user);
		}
	} catch (error) {
		logger.error(`Error in refreshAccessTokens: ${error.message}`);
		console.error(error);
	}
}

/**
 * Refresh the access token for a single user.
 */
async function refreshAccessTokenForUser(user) {
	const url = `${ASTRA_URL}/v1/oauth/token`;
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: user.refresh_token,
		redirect_uri: 'https://portal.hifibridge.com/auth/astraRedirect',
	});

	const options = {
		method: 'POST',
		headers: {
			'accept': 'application/json',
			'authorization': `Basic ${ASTRA_CREDENTIALS}`,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (!response.ok) {
			await supabase
				.from('logs')
				.insert({
					log: `Error while refreshing token: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: user.merchant_id,
					endpoint: 'POST /v1/oauth/token',
				});

			logger.error(`Failed to refresh token for user ${user.merchant_id}: ${JSON.stringify(data)}`);
			return;
		}

		const { data: updateData, error: updateError } = await supabase
			.from('astra_users')
			.update({
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				last_refresh_at: new Date(),
				expires_in: data.expires_in
			})
			.eq('id', user.id);

		if (updateError) {
			logger.error(`Failed to update token for user ${user.merchant_id}: ${updateError.message}`);
		} else {
			logger.info(`Successfully refreshed token for user ${user.merchant_id}`);
		}
	} catch (error) {
		logger.error(`Exception while refreshing token for user ${user.merchant_id}: ${error.message}`);
		console.error(error);
	}
}

// Schedule the token refresh task to run every 24 hours at 9 pm EST during daylight savings or 8 pm EST otherwise
cron.schedule('0 0 1 * * *', () => {
	console.log('Running the scheduled task to refresh access tokens...');
	refreshAccessTokens();
});


exports.createAccountByPlaidProcessorToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, processorToken, institutionId } = req.body;

	if (!merchantId || !processorToken) {
		return res.status(400).json({ error: 'merchantId and processorToken are required' });
	}

	const { data: astraUserData, error: astraUserError } = await supabase
		.from('astra_users')
		.select("access_token")
		.eq('merchant_id', merchantId)
		.single();

	console.log('astraUserData', astraUserData);
	console.log('astraUserError', astraUserError);

	if (astraUserError) {
		logger.error(`Error while fetching user data: ${astraUserError.message}`);
		return res.status(500).json({
			error: `astraUserError db error: ${JSON.stringify(astraUserError)}`,
		});
	}

	if (!astraUserData) {
		return res.status(400).json({ error: 'No user found for merchantId' });
	}

	const url = `${ASTRA_URL}/v1/accounts/processor_token`;
	const body = {
		processor_token: processorToken
	};

	if (institutionId) {
		body.institution_id = institutionId;
	}

	const options = {
		method: 'POST',
		headers: {
			'accept': 'application/json',
			'authorization': `Bearer ${astraUserData.access_token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	console.log('options', options);

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		console.log('data', data);

		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while creating account with processor token: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /astra/accounts/processor_token',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: accountData, error: accountError } = await supabase
			.from('astra_accounts')
			.insert({
				merchant_id: merchantId,
				type: "plaid_processor_token",
				plaid_processor_token: processorToken,
				institution_id: institutionId,
				astra_account_id: data.id
			});

		if (accountError) {
			logger.error(`Error while creating account with processor token: ${accountError.message}`);
			return res.status(500).json({
				error: `Error: ${JSON.stringify(accountError)}`,
			});
		}

		return res.json(data);
	} catch (error) {
		console.error(`Error while exchanging auth code: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while exchanging auth code: ${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /astra/oauth/token',
			})

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};


exports.createAccountForVirtualAccount = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, virtualAccountId } = req.body;

	if (!merchantId || !virtualAccountId) {
		return res.status(400).json({ error: 'merchantId and virtualAccountId are required' });
	}

	// Get astra user access token for the call to Astra
	const { data: astraUserData, error: astraUserError } = await supabase
		.from('astra_users')
		.select("access_token")
		.eq('merchant_id', merchantId)
		.single();

	console.log('astraUserData', astraUserData);
	console.log('astraUserError', astraUserError);

	if (astraUserError) {
		logger.error(`Error while fetching user data: ${astraUserError.message}`);
		return res.status(500).json({
			error: `astraUserError db error: ${JSON.stringify(astraUserError)}`,
		});
	}

	if (!astraUserData) {
		return res.status(400).json({ error: 'No user found for merchantId' });
	}


	// Get the routing number, account number, bank name, and institution type  of the virtual account
	const { data: virtualAccountData, error: virtualAccountError } = await supabase
		.from('bridge_virtual_accounts')
		.select("deposit_instructions_bank_routing_number, deposit_instructions_bank_account_number, deposit_instructions_bank_name")
		.eq('id', virtualAccountId)
		.single();

	console.log('virtualAccountData', virtualAccountData);

	if (virtualAccountError) {
		logger.error(`${virtualAccountError}`);
		return res.status(500).json({
			error: `virtualAccountError db error: ${JSON.stringify(virtualAccountError)}`,
		});
	}

	if (!virtualAccountData) {
		return res.status(400).json({ error: 'No virtual account found for virtualAccountId' });
	}


	const url = `${ASTRA_SECURE_URL}/v1/accounts/create`;
	const body = {
		institution_id: 'LEADBANK INSTITUTION ID',//FIXME: get institution id from astra
		name: virtualAccountData.deposit_instructions_bank_name,
		bank_account_type: 'checking',
		account_number: virtualAccountData.deposit_instructions_bank_account_number,
		routing_number: virtualAccountData.deposit_instructions_bank_routing_number
	}


	const options = {
		method: 'POST',
		headers: {
			'accept': 'application/json',
			'authorization': `Bearer ${astraUserData.access_token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	console.log('options', options);

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		console.log('createAccountForVirtualAccount data', data);

		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /astra/accounts/create/virtual_account',
				})


			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: accountData, error: accountError } = await supabase
			.from('astra_accounts')
			.insert({
				merchant_id: merchantId,
				type: "virtual_account_routing_account_number",
				institution_id: institutionId,
				astra_account_id: data.id,
				name: astraUserData.deposit_instructions_bank_name,
				account_number: astraUserData.deposit_instructions_bank_account_number,
				routing_number: astraUserData.deposit_instructions_bank_routing_number

			});

		if (accountError) {
			logger.error(`Error while creating account with processor token: ${accountError.message}`);
			return res.status(500).json({
				error: `Error: ${JSON.stringify(accountError)}`,
			});
		}

		return res.json(data);
	} catch (error) {
		console.error(`Error while creating astra account for virtual account: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: ` ${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /astra/accounts/create/virtual_account',
			})


		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};