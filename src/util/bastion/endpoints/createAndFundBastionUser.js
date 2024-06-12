const supabase = require("../../supabaseClient");
const fundMaticPolygon = require("../fundMaticPolygon");
const createLog = require("../../logger/supabaseLogger");
const submitBastionKyc = require("./submitBastionkyc");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;

/**
 * Throws a structured error for API failures.
 * @param {string} message - General error message.
 * @param {object} details - Detailed error information from API or internal logic.
 */
class BastionError extends Error {
	constructor(message, details, status) {
		super(message);
		this.details = details;
		this.status = status;
	}
}

/**
 * Core function to create a user in Bastion and handle associated wallet records.
 * @param {string} userId - Identifier for the user.
 * @returns {Promise<Object>} The response data from Bastion.
 */
async function createUserCore(userId) {
	const url = `${BASTION_URL}/v1/users`;
	const bodyObject = { id: userId, chains: ["ETHEREUM_TESTNET"] };

	// const bodyObject = { id: userId, chains: ["ETHEREUM_MAINNET", "POLYGON_MAINNET", "OPTIMISM_MAINNET", "BASE_MAINNET"] };
	const options = {
		method: "POST",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${BASTION_API_KEY}`
		},
		body: JSON.stringify(bodyObject),
	};

	const response = await fetch(url, options);
	const data = await response.json();


	if (response.status !== 201) {
		throw new BastionError(data.message, data.details, response.status);
	}

	if (Array.isArray(data.addresses) && data.addresses.length > 0) {
		for (const addressEntry of data.addresses) {
			for (const chain of addressEntry.chains) {
				const { data: insertData, error } = await supabase
					.from('bastion_wallets')
					.insert([{
						user_id: userId,
						chain: chain,
						address: addressEntry.address
					}])
					.select();

				if (error) {
					throw new Error(`Supabase insert error: ${JSON.stringify(error)}`);
				} else if (!(insertData && insertData.length > 0)) {
					logger.warn('Supabase insert resulted in no data or an empty response.');
				}

				// if chain is POLYGON_MAINNET, fund the wallet with 0.1 MATIC
				// if (chain === 'POLYGON_MAINNET') {
				// 	await fundMaticPolygon(userId, '0.15');
				// }
			}
		}
	} else {
		throw new BastionError("Could not parse addresses", "", 400, response.status, data);
	}

	return data; // Successfully created and possibly funded the user
}

/**
 * Public function to create and fund a Bastion user and passing kyc, handles errors.
 * @param {string} userId - The user's unique identifier.
 * @returns {Promise<Object>} A promise resolving to the API data or an error object.
 */
async function createAndFundBastionUser(userId) {
	try {
		console.log('About to call createUserCore');
		// create user
		const data = await createUserCore(userId);
		// submit kyc
		// if called means createUserCore is success
		const bastionKycResult = await submitBastionKyc(userId)
		return bastionKycResult;
	} catch (error) {
		if (error instanceof BastionError) {
			return {
				status: error.status,
				walletStatus: CustomerStatus.INACTIVE,
				invalidFileds: [],
				actions: [],
				message: "Unexpected error happened, please contact HIFI for more information"
			}
		}
		return {
			status: 500,
            walletStatus: CustomerStatus.INACTIVE,
            invalidFileds: [],
            actions: [],
            message: "Unexpected error happened, please contact HIFI for more information"
		}
	}
}


module.exports = createAndFundBastionUser;