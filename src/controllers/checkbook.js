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
