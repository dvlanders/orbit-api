const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');


const PLAID_URL = process.env.PLAID_URL;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;

/**
 * Exchange the Plaid public token for a Plaid access token.
 */
exports.exchangePublicTokenForAccessToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, publicToken } = req.body;

	if (!merchantId || !publicToken) {
		return res.status(400).json({ error: 'merchantId and publicToken are required' });
	}

	const url = `${PLAID_URL}/item/public_token/exchange`;
	const body = {
		client_id: PLAID_CLIENT_ID,
		secret: PLAID_SECRET,
		public_token: publicToken
	};

	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();
		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while exchanging public token: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /item/public_token/exchange',
				});

			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: updateData, error: updateError } = await supabase
			.from('plaid_accounts')
			.update({
				plaid_access_token: data.access_token,
				plaid_item_id: data.item_id,
				plaid_request_id: data.request_id,
			})
			.eq('public_token', publicToken);

		if (updateError) {
			throw new Error(`Database update error: ${updateError.message}`);
		}

		return res.json("Public token successfully exchanged for access token.");
	} catch (error) {
		console.error(`Error while exchanging public token: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `Error while exchanging public token: ${error}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /item/public_token/exchange',
			});


		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};



/**
 * Exchange the Plaid access token for a Plaid processor token.
 */
exports.exchangeAccessTokenForProcessorToken = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId, accountId, processor } = req.body;

	if (!merchantId || !accountId) {
		return res.status(400).json({ error: 'merchantId and accountId are required' });
	}

	const { data: accountData, error: accountError } = await supabase
		.from('plaid_accounts')
		.select('plaid_access_token')
		.eq('account_id', accountId)
		.single();



	if (accountError) {
		return res.status(500).json({
			error: `Error: ${JSON.stringify(accountError)}`,
		});
	}

	if (!accountData) {
		return res.status(404).json({
			error: `Account not found for ID: ${accountId}`,
		});
	}

	const plaidAccessToken = accountData.plaid_access_token;


	const url = `${PLAID_URL}/processor/token/create`;
	const body = {
		client_id: PLAID_CLIENT_ID,
		secret: PLAID_SECRET,
		access_token: plaidAccessToken,
		account_id: accountId,
		processor: processor
	};


	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();
		if (!response.ok) {
			const { data: logData, error: logError } = await supabase
				.from('logs')
				.insert({
					log: `Error while exchanging access token for processor token: ${JSON.stringify(data)}`,
					status: response.status,
					merchant_id: merchantId,
					endpoint: 'POST /processor/token/create',
				});

			return res.status(response.status).json({
				error: JSON.stringify(data),
			});
		}

		const { data: updateData, error: updateError } = await supabase
			.from('plaid_accounts')
			.update({
				processor_token: data.processor_token,
				plaid_processor_token_request_id: data.request_id,
				processor: processor,
			})
			.eq('account_id', accountId);

		if (updateError) {
			throw new Error(`Database update error: ${updateError.message}`);
		}

		return res.json("Access token successfully exchanged for processor token.");
	} catch (error) {
		console.error(`Error while exchanging public token: ${error}`);

		if (error instanceof Error) {
			logger.error(`Error message: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
		}

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: `${JSON.stringify(error)}`,
				status: error.status,
				merchant_id: merchantId,
				endpoint: 'POST /processor/token/create',
			});



		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};
