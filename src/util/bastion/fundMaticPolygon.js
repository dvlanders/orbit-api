const fetch = require('node-fetch');
const { v4: uuidv4 } = require("uuid");
const supabase = require('../supabaseClient');
const { Chain } = require('../common/blockchain');
const createLog = require('../logger/supabaseLogger');
const { getBastionWallet } = require('./utils/getBastionWallet');

/**
 * Uses Bastion to send MATIC on Polygon Mainnet
 * @param {string} toWalletAddress - The address of the recipient's wallet.
 * @param {string} amount - The amount of tokens to send / 10e6
 * @returns {Promise<Object>} - A promise that resolves to the transaction result.
 */
const BASTION_API_KEY = process.env.BASTION_API_KEY;
const BASTION_URL = process.env.BASTION_URL;
const chain = process.env.NODE_ENV == "development" ? Chain.POLYGON_AMOY : Chain.POLYGON_MAINNET
const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df' // this is the user id in bastion prod that has been prefunded with MATIC to serve as gas station wallet
const gasStationWalletAddress = '0x9Bf9Bd42Eb098C3fB74F37d2A3BA8141B5785a5f'
async function fundMaticPolygon(userId, amount, type = "INDIVIDUAL") {
	try {
		// get user wallet
		const walletAddress = await getBastionWallet(userId, chain, type)
		if (!walletAddress) throw new Error(`No user wallet found`)

		const requestId = uuidv4();
		const fromMerchantId = gasStation; // samuelyoon0 merchantId which has been prefunded with MATIC to serve as gas station wallet
		const bodyObject = {
			requestId: requestId,
			userId: fromMerchantId,
			chain: chain,
			currencySymbol: 'MATIC',
			amount: amount,
			recipientAddress: walletAddress,

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
		if (!response.ok) {
			throw JSON.stringify(data);
		}

		const { data: gasData, error: gasError } = await supabase
			.from('bastion_gas_station_transactions')
			.insert({
				request_id: requestId,
				// source_user_id: fromMerchantId,
				destination_user_id: userId,
				source_wallet_address: gasStationWalletAddress,
				destination_wallet_address: walletAddress,
				amount: amount,
				chain: chain,
				bastion_response: data,
				transaction_hash: data.transactionHash,
				status: data.status,
				gas_sponsor_bastion_user_id: gasStation
			});

		if (gasError) {
			console.error("Error inserting gas transaction into database:", gasError);
			throw gasError;
		}

		return data;

	} catch (error) {
		await createLog("user/util/fundMaticPolygon", userId, error.message, error)
		return null
		// throw JSON.stringify(error);
	}
}

module.exports = fundMaticPolygon;
