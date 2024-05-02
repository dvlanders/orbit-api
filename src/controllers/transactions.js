const supabase = require('../util/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { validate: uuidValidate } = require('uuid');
const axios = require('axios'); // Import axios to make HTTP requests
const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;

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

exports.sendTransactionConfirmationEmail = async (req, res) => {
	if (req.method !== 'POST') {
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
