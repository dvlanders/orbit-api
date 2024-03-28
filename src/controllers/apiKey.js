const AWS = require('aws-sdk');
const { v4: uuidv4 } = require("uuid");
const supabase = require('../util/supabaseClient');

AWS.config.update({ region: 'us-east-1' });
const apigateway = new AWS.APIGateway();

// TODO: Figure out api key environments
// Merchant dashboard will hit this endpoint to generate an API key
const generateApiKey = async (req, res) => {
	try {
		const merchantId = req.body.merchantId;
		const userId = req.body.userId;
		const defaultDescription = `API Key for merchant ${merchantId}`;
		const description = req.params.description || defaultDescription;

		const params = {
			name: req.body.name,
			description: description,
			enabled: true,
		};

		const apiKeyResponse = await apigateway.createApiKey(params).promise();

		const apiKeyRecord = {
			name: params.name,
			description: params.description,
			merchant_id: merchantId,
			user_id: userId,
			environment: "development", // FIXME: Adjust environment as needed
			api_key_id: apiKeyResponse.id,
		};

		const { data, error } = await supabase
			.from('api_keys')
			.insert([apiKeyRecord]);

		if (error) throw error;

		return res.status(200).json({
			message: 'API key generated and saved successfully',
			apiKey: apiKeyResponse,

		});
	} catch (error) {
		console.error('Error generating or saving API key:', error);
		return res.status(500).json({
			message: 'Failed to generate or save API key',
			error: error.message,
		});
	}
};

const getApiKeys = async (req, res) => {
	try {
		const merchantId = req.query.merchantId

		const { data, error } = await supabase
			.from('api_keys')
			.select('*')
			.eq('merchant_id', merchantId);


		if (error) throw error;

		return res.status(200).json({
			data: data

		});
	} catch (error) {
		console.error('Error fetching API key:', error);
		return res.status(500).json({
			message: 'Failed to fetch API keys',
			error: error.message,
		});
	}
};

module.exports = { generateApiKey, getApiKeys };
