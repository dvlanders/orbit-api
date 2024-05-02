const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { validate: uuidValidate } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const fetch = require('node-fetch');
const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;

// exports.sendTransactionConfirmationEmail = async (req, res) => {
// 	if (req.method !== 'POST') {
// 		return res.status(405).json({ error: 'Method not allowed' });
// 	}

// 	const { requestId } = req.body;
// 	if (!requestId) {
// 		return res.status(400).json({ error: 'requestId is required' });
// 	}

// 	try {
// 		const { data: transactionData, error: transactionError } = await supabase
// 			.from('onchain_transactions')
// 			.select(`*, from_merchant:from_merchant_id (*,profiles (*))`)
// 			.eq('request_id', requestId)
// 			.single();

// 		if (transactionError || !transactionData) {
// 			return res.status(404).json({ error: 'No transaction data found for the given request ID' });
// 		}

// 		console.log('transactionData', transactionData)


// 		const { data: transactionData, error: transactionError } = await supabase
// 		.from('onchain_transactions')
// 		.select(`*, from_merchant:from_merchant_id (*,profiles (*))`)
// 		.eq('request_id', requestId)
// 		.single();


// 		const usdAmount = transactionData.amount / 1e6;
// 		// if the transactionData.frommerchant.business_name is an empty string, then we should use the transactionData


// 		// const form = new FormData();
// 		// form.append('from', `Excited User <mailgun@${process.env.MAILGUN_DOMAIN}>`);
// 		// form.append('to', transactionData.destination_email);  // Assuming 'email' is a field in transactionData
// 		// form.append('subject', 'Transaction Confirmation');
// 		// form.append('html', `Your transaction with ID ${transactionData.request_id} has been processed successfully!`);

// 		// const authHeader = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
// 		// const response = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
// 		//     method: 'POST',
// 		//     headers: {
// 		//         Authorization: authHeader
// 		//     },
// 		//     body: form
// 		// });

// 		// const responseData = await response.json();
// 		return res.json('blah blah blah');

// 	} catch (error) {
// 		console.error(`Something went wrong: ${error.message}`);
// 		return res.status(500).json({
// 			error: `Something went wrong: ${error.message}`,
// 		});
// 	}
// };


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

