const AWS = require('aws-sdk');
const apiKeyModel = require("./../models/apiKey");
const { v4: uuidv4 } = require("uuid");



AWS.config.update({ region: 'us-east-1' });
const apigateway = new AWS.APIGateway();

const generateApiKey = async (req, res) => {
	try {
		const userId = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'; // Ideally, this would come from `req.user.id`

		const params = {
			name: `apiKey-${userId}-${Date.now()}`,
			description: `API Key for user ${userId}`,
			enabled: true,
		};

		// Create the API key using AWS API Gateway
		const apiKeyResponse = await apigateway.createApiKey(params).promise();

		// Prepare the record to save in DynamoDB
		const apiKeyRecord = new apiKeyModel({
			id: uuidv4(),
			user_id: userId,
			name: params.name,
			description: params.description,
			enabled: params.enabled,
			environment: "development", // FIXME: Set environment as needed
			apiKeyId: apiKeyResponse.id,
			apiKeyValue: apiKeyResponse.value,
		});

		// Save the record in DynamoDB
		await apiKeyRecord.save();

		return res.status(200).json({
			message: 'API key generated and saved successfully',
			details: apiKeyRecord,
		});
	} catch (error) {
		console.error('Error generating or saving API key:', error);
		return res.status(500).json({
			message: 'Failed to generate or save API key',
			error: error.message,
		});
	}
};

module.exports = { generateApiKey };
