const { createClient } = require('@supabase/supabase-js');
const { rs, responseCode } = require("./index");

const supabase = require('./supabaseClient');

/**
 * Middleware to validate an API key from the request header against Supabase.
 */
exports.validateApiKey = async (req, res, next) => {
	try {
		const apiKeyValue = req.headers['x-api-key'];

		if (!apiKeyValue) {
			console.error('API key is required in the request header');
			return res.status(400).json(rs.response(responseCode.badRequest, 'API key is required in the request header', {}));
		}

		const { data, error } = await supabase
			.from('external_api_keys')
			.select('*')
			.eq('value', apiKeyValue)
			.single();

		if (error) {
			console.error('Error fetching API key from Supabase:', error);
			return res.status(500).json(rs.errorResponse('Failed to validate API key', error.message));
		}

		// FIXME: add logging for checking if data.environment is equal to the current env

		if (!data || data.status !== 'active' || (data.expires_at && new Date(data.expires_at) < new Date())) {
			return res.status(401).json(rs.response(responseCode.unauthorized, 'Invalid or expired API key', {}));
		}

		req.apiKeyPermissions = data.permissions;
		next();
	} catch (err) {
		console.error('Error validating API key:', err);
		return res.status(500).json(rs.errorResponse('Failed to validate API key', err.toString()));
	}
};
