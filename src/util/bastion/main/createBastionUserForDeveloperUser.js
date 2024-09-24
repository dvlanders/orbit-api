const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const { createUser } = require("../endpoints/createUser");
const { Chain } = require("../../common/blockchain");
const { getAddress, isAddress } = require("ethers")
const { BastionSupportedEVMChainSandbox, BastionSupportedEVMChainProd } = require("../utils/utils");
const submitBastionKycForDeveloper = require("./submitBastionKycForDeveloperUser");
const fundUserGasFee = require("../fundGasFee");
const chains = process.env.NODE_ENV == "development" ? BastionSupportedEVMChainSandbox : BastionSupportedEVMChainProd

const preFundAmount = '0.1'

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
async function createBastionDeveloperWallet(userId, type) {
	const bastionUserId = `${userId}-${type}`
	const response = await createUser(bastionUserId)
	const data = await response.json();

	if (response.status == 409) {
		throw new BastionError(data.message, data.details, response.status);
	}

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
						address: isAddress(addressEntry.address) ? getAddress(addressEntry.address) : addressEntry.address,
						type: type,
						bastion_user_id: bastionUserId
					}])
					.select();

				if (error) {
					throw new Error(`Supabase insert error: ${JSON.stringify(error)}`);
				} else if (!(insertData && insertData.length > 0)) {
					logger.warn('Supabase insert resulted in no data or an empty response.');
				}
				// if chain is POLYGON_MAINNET, fund the wallet with 0.1 MATIC
				if (chain === Chain.POLYGON_MAINNET) {
					await fundUserGasFee(userId, preFundAmount, Chain.POLYGON_MAINNET, type);
				}
			}
		}
	} else {
		throw new BastionError("Could not parse addresses", "", 400, response.status, data);
	}

}

/**
 * Public function to create and fund a developer Bastion user and passing kyc, handles errors.
 * @param {string} userId - The user's unique identifier.
 * @returns {Promise<Object>} A promise resolving to the API data or an error object.
 */
async function createBastionDeveloperUser(userId) {
	try {
		// create wallet
		await Promise.all([
			createBastionDeveloperWallet(userId, "PREFUNDED"),
			createBastionDeveloperWallet(userId, "FEE_COLLECTION")
		])

		// submit kyc
		await Promise.all([
			submitBastionKycForDeveloper(userId, "PREFUNDED"),
			submitBastionKycForDeveloper(userId, "FEE_COLLECTION")
		])

	} catch (error) {
		await createLog("bastion/createBastionDeveloperUser", userId, error.message)
	}
}

async function createBastionDeveloperUserWithType(userId, type) {
	try {
		// create wallet
		await Promise.all([
			createBastionDeveloperWallet(userId, type),
		])

		// submit kyc
		await Promise.all([
			submitBastionKycForDeveloper(userId, type),
		])

	} catch (error) {
		await createLog("bastion/createBastionDeveloperUser", userId, error.message)
		throw error
	}
}


module.exports = { createBastionDeveloperUser, createBastionDeveloperWallet, createBastionDeveloperUserWithType };