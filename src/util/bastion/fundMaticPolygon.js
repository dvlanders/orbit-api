const fetch = require('node-fetch');
const { v4: uuidv4 } = require("uuid");
const supabase = require('../supabaseClient');

/**
 * Uses Bastion to send MATIC on Polygon Mainnet
 * @param {string} toWalletAddress - The address of the recipient's wallet.
 * @param {string} amount - The amount of tokens to send / 10e6
 * @returns {Promise<Object>} - A promise that resolves to the transaction result.
 */
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;

async function fundMaticPolygon(toMerchantId, toWalletAddress, amount) {

	try {
		const requestId = uuidv4();
		const chain = 'POLYGON_MAINNET';
		const fromMerchantId = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'; // samuelyoon0 merchantId which has been prefunded with MATIC to serve as gas station wallet
		const bodyObject = {
			requestId: requestId,
			userId: fromMerchantId,

			chain: chain,
			currencySymbol: 'MATIC',
			amount: amount,
			recipientAddress: toWalletAddress,

		};

		const url = `${BASTION_URL}/v1/crypto/transfers`;
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

		if (data.status === 'SUBMITTED' || data.status === 'ACCEPTED' || data.status === 'PENDING') {
			const { data: gasData, error: gasError } = await supabase
				.from('gas_station_transactions')
				.insert({
					request_id: requestId,
					from_merchant_id: fromMerchantId,
					to_merchant_id: toMerchantId,
					to_merchant_wallet_address: toWalletAddress,
					amount: amount,
					chain: chain,
					bastion_response: data,
					transaction_hash: data.transactionHash,
					status: 1
				});

			if (gasError) {
				console.error("Error inserting gas transaction into database:", gasError);
				throw gasError;
			}

			return {
				message: 'Gas transaction submitted successfully',
				bastionResponse: gasData
			};
		} else {
			throw new Error(`Bastion response: ${JSON.stringify(data)}`);
		}
	} catch (error) {
		console.error("Error during MATIC transfer:", JSON.stringify(error));

		const { data: logData, error: logError } = await supabase
			.from('logs')
			.insert({
				log: error.toString(),
				merchant_id: toMerchantId,
				endpoint: 'fundMaticPolygon util function'
			});

		throw JSON.stringify(error);
	}
}

module.exports = fundMaticPolygon;
