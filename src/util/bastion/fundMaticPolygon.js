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

async function fundMaticPolygon(userId, amount) {

	const { data: walletData, error: walletError } = await supabase
		.from('bastion_wallets')
		.select('address')
		.eq('userId', userId)
		.eq('chain', 'POLYGON_MAINNET')
		.single();

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
			recipientAddress: walletData.address,

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

		if (response.status !== 201) {
			console.error("Error during MATIC transfer:", JSON.stringify(data));
			throw JSON.stringify(data);
		}

		const { data: gasData, error: gasError } = await supabase
			.from('gas_station_transactions')
			.insert({
				request_id: requestId,
				source_user_id: fromMerchantId,
				destination_user_id: toMerchantId,
				source_wallet_address: toWalletAddress,
				destination_wallet_address: walletData.address,
				amount: amount,
				chain: chain,
				bastion_response: data,
				transaction_hash: data.transactionHash,
				status: data.status
			});

		if (gasError) {
			console.error("Error inserting gas transaction into database:", gasError);
			throw gasError;
		}

		return data;

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
