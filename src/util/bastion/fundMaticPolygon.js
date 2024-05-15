const fetch = require('node-fetch'); // Ensure you have node-fetch if not already installed
const supabase = require('./supabaseClient');

/**
 * Uses Bastion to send MATIC on Polygon Mainnet
 * @param {string} toWalletAddress - The address of the recipient's wallet.
 * @param {string} amount - The amount of tokens to send / 10e6
 * @returns {Promise<Object>} - A promise that resolves to the transaction result.
 */

const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

async function fundMaticPolygon(toWalletAddress, amount) {
	try {
		const requestId = uuidv4();
		const contractAddress = "0x0000000000000000000000000000000000001010"; //  MATIC contract on Polygon Mainnet (dummy value)
		const actionName = 'transfer'; // This action has been pre-configured in Bastion as a contract action
		const chain = 'POLYGON_MAINNET';
		const merchantId = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'; // Sam's samuelyoon0@gmail.com merchantId which has been prefunded with a bunch of MATIC will serve as the gas station wallet

		const bodyObject = {
			requestId: requestId,
			userId: merchantId,
			contractAddress: contractAddress,
			actionName: actionName,
			chain: chain,
			actionParams: [
				{ name: "to", value: toWalletAddress },
				{ name: "value", value: amount }
			],
		};

		const url = `${BASTION_URL}/v1/user-actions`;
		const options = {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				Authorization: `Bearer ${BASTION_API_KEY}`
			},
			body: JSON.stringify(bodyObject)
		};

		const response = await fetch(url, options);
		const data = await response.json();

		if (data.status === 'SUBMITTED' || 'ACCEPTED' || 'PENDING') {
			return {
				message: 'Transaction submitted successfully',
				bastionResponse: data
			};
		} else if (data.status === 'CONFIRMED') {
			throw new Error(`Failed to execute transfer. Status: ${data.status}. Message: ${JSON.stringify(data)}`);
		} else if (data.status === 'FAILED') {
			throw new Error(`Failed to execute transfer. Status: ${data.status}. Message: ${JSON.stringify(data)}`);
		} else {
			throw new Error(`Failed to execute transfer. Unrecognized Status: ${data.status}. Message: ${JSON.stringify(data)}`);
		}
	} catch (error) {
		console.error("Error during MATIC transfer:", error);
		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: JSON.stringify(error),
				merchant_id: merchantId,
				endpoint: '/bastion/submitKyc'
			})
		throw error;
	}
}

module.exports = fundMaticPolygon;
