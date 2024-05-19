const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require("uuid");
const { request } = require('express');
const fundMaticPolygon = require('../util/bastion/fundMaticPolygon');
const { astra } = require('.');

const ASTRA_URL = process.env.ASTRA_URL;
const ASTRA_CLIENT_ID = process.env.ASTRA_CLIENT_ID;
const ASTRA_CLIENT_SECRET = process.env.ASTRA_CLIENT_SECRET;
const ASTRA_CREDENTIALS = Buffer.from(`${ASTRA_CLIENT_ID}:${ASTRA_CLIENT_SECRET}`).toString('base64');

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

		// save the access_token and refresh_token to the database
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
