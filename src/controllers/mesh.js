const { v4: uuidv4 } = require('uuid');
const { logger } = require('../util/logger/logger');
const { responseCodes, rs } = require('../util/Constants');
const { common } = require('../util/helper');
const fetch = require('node-fetch'); // Ensure you have 'node-fetch' or a similar library installed for making HTTP requests

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_CLIENT_ID = process.env.MESH_CLIENT_ID;
const DESTINATION_ADDRESS = process.env.DESTINATION_ADDRESS;// currently sert to sam's wallet

// hosted checkout page hits this to generate a linkToken object for the MeshModal
exports.createTransaction = async (req, res) => {
	const { customerId, transactionId, amountInFiat } = req.body;

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const bodyObject = {
		userId: customerId,
		restrictMultipleAccounts: true,
		// allows exchange on-ramp to happen
		fundingOptions: {
			"Enabled": true
		},
		transferOptions: {
			toAddresses: [
				{
					networkId: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12", // Polygon network ID
					symbol: "USDC",
					address: DESTINATION_ADDRESS,
				}
			],
			amountInFiat: amountInFiat, //FIXME: Adjust this to your actual amount
			transactionId: transactionId,
			// clientFee: 0.01, // if we ever want to charge a % fee to the customer
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
}
