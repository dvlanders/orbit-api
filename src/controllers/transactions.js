const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { validate: uuidValidate } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const fetch = require('node-fetch');
const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;

exports.sendTransactionConfirmationEmail = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { requestId } = req.body;
	if (!requestId) {
		return res.status(400).json({ error: 'requestId is required' });
	}

	try {
		const { data: transactionData, error: transactionError } = await supabase
			.from('onchain_transactions')
			.select(`*, from_merchant:from_merchant_id (*,profiles (*))`)
			.eq('request_id', requestId)
			.single();

		if (transactionError || !transactionData) {
			return res.status(404).json({ error: 'No transaction data found for the given request ID' });
		}

		console.log('transactionData', transactionData);
		let fromName;

		if (transactionData.from_merchant.business_name === '') {
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select(`*`)
				.eq('merchant_id', transactionData.from_merchant_id);

			console.log('profileData', profileData)

			if (profileError || !profileData[0] || profileData.length === 0) {
				console.error('No profile data found for the "from" merchant id ');
				return res.status(404).json({ error: 'No profile data found for the associated merchant id' });
			}

			// console.log('profileData', profileData);
			fromName = profileData[0].full_name;
		} else {
			fromName = transactionData.from_merchant.business_name;
		}

		const usdAmount = transactionData.amount / 1e6;

		const form = new FormData();
		form.append('from', `HIFI Notifications <noreply@${process.env.MAILGUN_DOMAIN}>`);
		form.append('to', transactionData.destination_email);
		form.append('template', 'onchain_transaction_confirmation_template');
		form.append('v:transaction_id', `${transactionData.request_id}`);
		form.append('v:from_name', `${fromName}`);
		form.append('v:usd_amount', `${usdAmount.toFixed(2)}`);

		const authHeader = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
		const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
			method: 'POST',
			headers: {
				'Authorization': authHeader
			},
			body: form
		});

		if (!response.ok) {
			const textResponse = await response.text();
			console.error('Failed to send email:', textResponse);
			return res.status(500).json({ error: 'Failed to send email, server responded with: ' + textResponse });
		}

		const responseData = await response.json();
		return res.json(responseData);
	} catch (error) {
		console.error('An error occurred:', error);
		return res.status(500).json({ error: error.message });
	}
};



exports.getTransaction = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	// Correctly destructure the transactionId from req.query
	const { transactionId } = req.query;

	// Add a check to block null or undefined transactionId
	if (!transactionId) {
		return res.status(400).json({ error: 'Transaction ID is required' });
	}

	// Example of using query parameters, modify according to your needs
	const queryParams = {
		clientTransactionId: transactionId,
	};

	try {
		// Assuming you have set your Mesh API key in your environment variables
		const response = await axios.get('https://integration-api.getfront.com/api/v1/transfers/managed/mesh', {
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'X-Client-Id': MESH_CLIENT_ID,
				'X-Client-Secret': MESH_API_KEY,
			},
			params: queryParams
		});

		// Log the result from the Mesh API call
		console.log(response.data);

		// Respond back to your client as needed
		return res.json({
			success: true,
			data: response.data
		});

	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};

