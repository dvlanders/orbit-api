const AWS = require('aws-sdk');
const { rs, responseCode } = require("./index"); // Assuming these are utility functions for response shaping

// Configure AWS region
AWS.config.update({ region: 'us-east-1' });
const apigateway = new AWS.APIGateway();

/**
 * Middleware to validate an API key from the request header against AWS API Gateway.
 */
exports.validateApiKey = async (req, res, next) => {
	try {
		// Extract API key from the request header. Assuming the header field is 'x-api-key'
		const apiKey = req.headers['x-api-key'];

		if (!apiKey) {
			// No API key provided in the request
			return res.status(400).json(rs.response(responseCode.badRequest, 'API key is required in the request header', {}));
		}

		// Parameters for getApiKey API call
		const params = {
			apiKey: apiKey,
			includeValue: false // Set to true if you need to compare the value, but usually, the ID is sufficient
		};

		// Check API key validity with AWS API Gateway
		const apiKeyDetails = await apigateway.getApiKey(params).promise();

		if (!apiKeyDetails || !apiKeyDetails.enabled) {
			// API key is invalid or not enabled
			return res.status(401).json(rs.response(responseCode.unauthorized, 'Invalid or disabled API key', {}));
		}

		// Optionally, implement further logic here (e.g., checking API key against a specific usage plan)

		// API key is valid, proceed with the request
		next();
	} catch (err) {
		if (err.statusCode === 404) {
			// API key not found in AWS API Gateway
			return res.status(401).json(rs.response(responseCode.unauthorized, 'API key not found or unauthorized', {}));
		} else {
			// Other errors (e.g., AWS service issues)
			console.error('Error validating API key:', err);
			return res.status(500).json(rs.errorResponse('Failed to validate API key', err.toString()));
		}
	}
};
