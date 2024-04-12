const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

exports.createUser = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;
	// const chains = ["ETHEREUM_MAINNET", "POLYGON_MAINNET", "OPTIMISM_MAINNET"]; // According to Alex @ Bastion, spinning up a single wallet will spin up wallets for all chains, but i am specifying all networks for clairty
	const chains = ["ETHEREUM_TESTNET", "POLYGON_TESTNET", "OPTIMISM_SEPOLIA"]; // FIXME: DEV ONLY

	const bodyObject = {
		id: merchantId,
		chains: chains
	};

	const url = `${BASTION_URL}/v1/users`;

	const options = {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject)
	};


	try {
		const response = await fetch(url, options);
		const data = await response.json();

		console.log('data from bastion call', data);

		if (response.status !== 201) {
			const errorMessage = `Failed to create user. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			throw new Error(errorMessage);
		}


		if (Array.isArray(data.addresses) && data.addresses.length > 0) {
			for (const addressEntry of data.addresses) {
				for (const chain of addressEntry.chains) {
					const { data: insertData, error } = await supabase
						.from('wallets')
						.insert([{
							merchant_id: merchantId,
							chain: chain,
							address: addressEntry.address
						}]);

					if (error) {
						logger.error(`Supabase insert error: ${error.message}`);

						throw new Error(`Supabase insert error: ${error.message}`);
					} else if (insertData && insertData.length > 0) {
						logger.info(`Inserted wallet for ${chain}: ${insertData[0].id}`);
					} else {
						logger.warn('Supabase insert resulted in no data or an empty response.');
					}
				}
			}

		} else {
			throw new Error('No addresses found in Bastion response');
		}

		return res.status(201).json(data);
	} catch (error) {
		logger.error(`Something went wrong while creating user or inserting wallet records: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}

};

exports.getUser = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { merchantId } = req.body;

	const url = `${BASTION_URL}/v1/users/${merchantId}`;
	const options = {
		method: 'GET',
		headers: {
			accept: 'application/json',
			Authorization: `Bearer ${BASTION_API_KEY}`
		}
	};

	try {
		const response = await fetch(url, options);
		const data = await response.json();

		if (response.status !== 200) {
			const errorMessage = `Failed to get user. Status: ${response.status}. Message: ${data.message || 'Unknown error'}`;
			throw new Error(errorMessage);
		}

		return res.status(200).json(data);
	} catch (error) {
		logger.error(`Something went wrong while retrieving user: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};
