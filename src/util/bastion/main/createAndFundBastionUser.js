const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const submitBastionKyc = require("./submitBastionKyc");
const { createUser } = require("../endpoints/createUser");
const { getAllUserWallets } = require("../utils/getAllUserWallets");
const { CustomerStatus } = require("../../user/common");
const { Chain } = require("../../common/blockchain");
const { getAddress, isAddress } = require("ethers");
const fundUserGasFee = require("../../transfer/gas/main/fundGasFee");

const BASTION_URL = process.env.BASTION_URL;
const BASTION_API_KEY = process.env.BASTION_API_KEY;
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
async function createUserCore(userId, bastionUserId, walletType) {

	const response = await createUser(bastionUserId)
	const data = await response.json();

	if (response.status !== 201) {
		throw new BastionError(data.message, data.details, response.status);
	}

	if (Array.isArray(data.addresses) && data.addresses.length > 0) {
		for (const addressEntry of data.addresses) {
			for (const chain of addressEntry.chains) {
				const { data: insertData, error } = await supabase
					.from('bastion_wallets')
					.insert({
						user_id: userId,
						chain: chain,
						address: isAddress(addressEntry.address) ? getAddress(addressEntry.address) : addressEntry.address,
						bastion_user_id: bastionUserId,
						type: walletType
					})
					.select()
					.single()

				if (error) {
					throw new Error(`Supabase insert error: ${JSON.stringify(error)}`);
				}
				// insert in user_wallets table
				const { data: insertUserWalletData, error: insertUserWalletError } = await supabase
					.from('user_wallets')
					.insert({
						user_id: userId,
						chain: chain,
						address: insertData.address,
						wallet_provider: "BASTION",
						wallet_type: walletType,
						bastion_wallet_id: insertData.id
					})
				
				if (insertUserWalletError) throw insertUserWalletError
				
				// if chain is POLYGON_MAINNET, fund the wallet with 0.1 MATIC
				if (chain === Chain.POLYGON_MAINNET) {
					await fundUserGasFee(userId, preFundAmount, Chain.POLYGON_MAINNET);
				}
			}
		}
	} else {
		throw new BastionError("Could not parse addresses", "", 400, response.status, data);
	}

	const userWallets = await getAllUserWallets(userId)

	return userWallets; // Successfully created and possibly funded the user
}

/**
 * Public function to create and fund a Bastion user and passing kyc, handles errors.
 * @param {string} userId - The user's unique identifier.
 * @returns {Promise<Object>} A promise resolving to the API data or an error object.
 */
async function createAndFundBastionUser(userId, walletType = "INDIVIDUAL") {
	let bastionUserId = userId
	if (walletType !== "INDIVIDUAL") {
		bastionUserId = `${userId}-${walletType}`
	}
	try {
		// create user
		const walletAddress = await createUserCore(userId, bastionUserId, walletType);
		// submit kyc
		// if called means createUserCore is success
		const bastionKycResult = await submitBastionKyc(userId, bastionUserId)
		return { ...bastionKycResult, walletAddress };
	} catch (error) {
		await createLog("createAndFundBastionUser", userId, error.message, error)
		if (error instanceof BastionError) {
			return {
				status: error.status,
				walletStatus: CustomerStatus.INACTIVE,
				invalidFileds: [],
				actions: [],
				walletAddress: {},
				message: "Unexpected error happened, please contact HIFI for more information"
			}
		}
		return {
			status: 500,
			walletStatus: CustomerStatus.INACTIVE,
			invalidFileds: [],
			actions: [],
			walletAddress: {},
			message: "Unexpected error happened, please contact HIFI for more information"
		}
	}
}


module.exports = createAndFundBastionUser;