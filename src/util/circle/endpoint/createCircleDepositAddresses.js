const fetch = require('node-fetch');
const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");

const CIRCLE_URL = process.env.CIRCLE_URL;
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;

const chainToCircleChainValue = process.env.NODE_ENV === "development" ?
	{
		"ETHEREUM_TESTNET": "ETH",
		"OPTIMISM_TESTNET": "OP",
		"POLYGON_AMOY": "POLY"
	} :
	{
		"ETHEREUM_MAINNET": "ETH",
		"OPTIMISM_MAINNET": "OP",
		"POLYGON_MAINNET": "POLY"
	};

const createCircleDepositAddresses = async (userId, currency) => {
	const results = {};

	for (const chain in chainToCircleChainValue) {
		const chainValue = chainToCircleChainValue[chain];

		try {
			const headers = {
				'Accept': 'application/json',
				'Authorization': `Bearer ${CIRCLE_API_KEY}`,
				'Content-Type': 'application/json'
			};

			const circleDepositAddressUrl = `${CIRCLE_URL}/businessAccount/wallets/addresses/deposit`;
			const response = await fetch(circleDepositAddressUrl, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify({
					idempotencyKey: v4(),
					currency: currency,
					chain: chainValue
				})
			});

			const responseData = await response.json();
			if (response.ok) {
				const { address, addressTag } = responseData.data;
				results[chain] = {
					status: "ACTIVE",
					depositAddress: address,
					addressTag: addressTag,
					currency: responseData.data.currency,
					chain: responseData.data.chain
				};

				// Save to Supabase
				const { error } = await supabase
					.from('circle_deposit_addresses')
					.insert([{
						user_id: userId,
						chain: responseData.data.chain,
						currency: responseData.data.currency,
						address: address,
						address_tag: addressTag
					}]);

				if (error) {
					throw error;
				}

			} else {
				throw new Error(`API error: ${responseData.message}`);
			}

		} catch (error) {
			createLog("user/util/createCircleDepositAddresses", userId, error.message, error);
			results[chain] = {
				status: "INACTIVE",
				message: "Failed to create deposit address. Please try again later.",
				error: {
					message: error.message
				}
			};

			return {
				status: 500,
				depositAddresses: results
			};
		}
	}

	return {
		status: 200,
		depositAddresses: results
	};
}

module.exports = {
	createCircleDepositAddresses
};
