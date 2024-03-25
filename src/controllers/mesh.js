const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;

// Define a mapping function for networkId and symbol
function mapChainToDetails(chain) {
	const networkDetails = {
		ETHEREUM_MAINNET: { networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611', symbol: 'ETH' },
		POLYGON_MAINNET: { networkId: '7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12', symbol: 'MATIC' },
		ETHEREUM_TESTNET: { networkId: 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611', symbol: 'ETH' }, // this is mapped to mainnet for testing. mesh does not support testnets
		POLYGON_TESTNET: { networkId: '7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12', symbol: 'MATIC' }, // this is mapped to mainnet for testing. mesh does not support testnets

		// Add additional mappings as necessary
	};

	return networkDetails[chain] || { networkId: 'unknown', symbol: 'unknown' };
}

exports.createTransaction = async (req, res) => {
	const { customerId, transactionId, merchantId, amountFiat } = req.body;

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// Query the Supabase to fetch wallet addresses for the given merchantId
	let fetchedWallets;
	try {
		const { data, error } = await supabase
			.from('wallets')
			.select('chain, address')
			.eq('merchant_id', merchantId);

		if (error) {
			throw error;
		}

		fetchedWallets = data;
	} catch (error) {
		logger.error(`Failed to fetch wallet addresses from Supabase: ${error.message}`);
		return res.status(500).json({
			error: `Failed to fetch wallet addresses from Supabase: ${error.message}`,
		});
	}

	console.log('fetchedWallets', fetchedWallets);

	// Use the mapping function to populate the toAddresses
	const toAddresses = fetchedWallets.map(wallet => {
		const { networkId, symbol } = mapChainToDetails(wallet.chain);
		return {
			networkId: networkId,
			symbol: symbol,
			address: wallet.address,
		};
	});

	console.log('toAddresses', toAddresses);

	const bodyObject = {
		userId: customerId,
		restrictMultipleAccounts: true,
		fundingOptions: {
			"Enabled": true
		},
		transferOptions: {
			toAddresses: toAddresses,
			amountInFiat: amountFiat,
			transactionId: transactionId,
		}
	};

	try {
		const response = await fetch('https://integration-api.getfront.com/api/v1/linktoken', {
			method: 'POST',
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json',
				'X-Client-Id': MESH_CLIENT_ID,
				'X-Client-Secret': MESH_API_KEY,
			},
			body: JSON.stringify(bodyObject)
		});

		const data = await response.json();

		if (!response.ok) {
			const errorMessage = `Failed to retrieve or generate linkToken. Status: ${response.status}. Message: ${data.message}`;
			throw new Error(errorMessage);
		}

		return res.status(200).json(data);
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};
