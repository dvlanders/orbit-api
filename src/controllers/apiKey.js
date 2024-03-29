const { v4: uuidv4 } = require("uuid");
const supabase = require('../util/supabaseClient');



// Generate and save API key in Supabase
const generateApiKey = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}


	try {
		const { merchantId, userId, environment } = req.body;


		const apiKeyRecord = {
			value: uuidv4(),
			merchant_id: merchantId,
			environment: environment,
			status: "active",
			expires_at: null,
			permissions: {
				read: true,
				write: true
			},
			created_by_user_id: userId,
		};

		const { data, error } = await supabase
			.from('external_api_keys')
			.insert([apiKeyRecord])
			.select();

		if (error) throw error;

		return res.status(200).json({
			message: 'API key generated and saved successfully',
			apiKey: data[0],
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
		const merchantId = req.query.merchantId;

		const columns = 'id, created_at, expires_at, permissions, status, merchant_id, environment, created_by_user_id';

		const { data, error } = await supabase
			.from('external_api_keys')
			.select(columns)
			.eq('merchant_id', merchantId);

		if (error) throw error;

		return res.status(200).json({
			data: data
		});
	} catch (error) {
		console.error('Error fetching API keys:', error);
		return res.status(500).json({
			message: 'Failed to fetch API keys',
			error: error.message,
		});
	}
};


module.exports = { generateApiKey, getApiKeys };
