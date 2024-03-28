const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { responseCodes, rs } = require('../util/Constants');
const { common } = require('../util/helper');
const fetch = require('node-fetch');
const supabase = require('../util/supabaseClient');

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;

// hosted checkout page hits this to generate a linkToken object for the MeshModal
exports.createTransaction = async (req, res) => {
	const { customerId, transactionId, merchantId, amountFiat } = req.body;

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	// Initialize variables for wallet addresses
	let merchantEthAddress = "";
	let merchantPolygonAddress = "";
	let merchantOptimismAddress = "0xbE0594de0B936E32d485edB37E2c4B37b14C9222"; // FIXME: hardcoded for dev

	try {
		const { data: walletData, error: walletError } = await supabase
			.from('wallets')
			.select('*')
			.eq('merchant_id', merchantId);

		if (walletError) {
			throw new Error(walletError.message);
		}


		walletData.forEach(wallet => {
			switch (wallet.chain) {
				case 'ETHEREUM_MAINNET':
					merchantEthAddress = wallet.address;
					break;
				case 'POLYGON_MAINNET':
					merchantPolygonAddress = wallet.address;
					break;
				case 'OPTIMISM_MAINNET':
					merchantOptimismAddress = wallet.address;
					break;
				// FIXME: testnets dont exist for Mesh so comment this out in prod
				case 'ETHEREUM_TESTNET':
					merchantEthAddress = wallet.address;
					break;
				case 'POLYGON_TESTNET':
					merchantPolygonAddress = wallet.address;
					break;
				case 'OPTIMISM_SEPOLIA':
					merchantOptimismAddress = wallet.address;
					break;
			}
		});

		const toAddresses = [
			// eth mainnet
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "ETH",
				address: merchantEthAddress,
			},
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "USDC",
				address: merchantEthAddress,
			},
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "MATIC",
				address: merchantEthAddress,
			},
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "SHIB",
				address: merchantEthAddress,
			},
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "PYUSD",
				address: merchantEthAddress,
			},
			{
				networkId: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
				symbol: "USDT",
				address: merchantEthAddress,
			},
			// polygon
			{
				networkId: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
				symbol: "MATIC",
				address: merchantPolygonAddress,
			},
			{
				networkId: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
				symbol: "USDT",
				address: merchantPolygonAddress,
			},
			{
				networkId: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
				symbol: "USDC",
				address: merchantPolygonAddress,
			},
			// optimism
			{
				networkId: "18fa36b0-88a8-43ca-83db-9a874e0a2288",
				symbol: "ETH",
				address: merchantOptimismAddress,
			},
			{
				networkId: "18fa36b0-88a8-43ca-83db-9a874e0a2288",
				symbol: "OP",
				address: merchantOptimismAddress,
			},
			{
				networkId: "18fa36b0-88a8-43ca-83db-9a874e0a2288",
				symbol: "USDT",
				address: merchantOptimismAddress,
			},
			{
				networkId: "18fa36b0-88a8-43ca-83db-9a874e0a2288",
				symbol: "USDC",
				address: merchantOptimismAddress,
			},
			{
				networkId: "18fa36b0-88a8-43ca-83db-9a874e0a2288",
				symbol: "OP",
				address: merchantOptimismAddress,
			},

		]
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
				// Optional: clientFee: 0.01,
			}
		};

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
			throw new Error(`Failed to retrieve or generate linkToken. Status: ${response.status}. Message: ${data.message}`);
		}

		return res.status(200).json(data);
	} catch (error) {
		logger.error(`Something went wrong: ${error.message}`);
		return res.status(500).json({
			error: `Something went wrong: ${error.message}`,
		});
	}
};
