const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');


const PLAID_URL = process.env.PLAID_URL;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;

/**
 * Exchange the Plaid public token for a Plaid processor token.
 */
exports.exchangePublicTokenForProcessorToken = async (req, res) => {
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
				processor_token: merchantId
			})
			.eq('public_token', publicToken);

		if (updateError) {
			throw new Error(`Database update error: ${updateError.message}`);
		}

		return res.json("Processor token successfully exchanged.");
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

		console.log('logData', logData);
		console.log('logError', logError);

		return res.status(500).json({
			error: `Error: ${error.message || error.toString()}`,
			details: error.stack ? String(error.stack) : JSON.stringify(error, Object.getOwnPropertyNames(error)),
		});
	}
};
