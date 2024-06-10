const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const { BridgeCustomerStatus, virtualAccountPaymentRailToChain } = require("../utils");
const  createLog  = require("../../logger/supabaseLogger");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeVirtualAccountErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INACTIVE_USER: "INACTIVE_USER"
};

class createBridgeVirtualAccountError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createBridgeVirtualAccountError.prototype);
	}
}

const defaultRail = [
	{
		sourceCurrency: "usd",
		sourcePaymentRail: "ach",
		destinationCurrency: "usdc",
		destinationPaymentRail: "polygon"
	}
]

const developerFeePercent = "0.0" //FIX ME

const getUserWallet = async (chain, userId) => {

	let { data: bastion_wallets, error } = await supabase
		.from('bastion_wallets')
		.select('address')
		.eq('user_id', userId)
		.eq("chain", chain)
		.maybeSingle()

	if (error) {
		throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, error.message, error);
	}
	if (!bastion_wallets) {
		throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.RECORD_NOT_FOUND, "User wallet not found");
	}

	return bastion_wallets.address

}

/**
 * This util function use to create bridge virtual account, return status 200 for all success creation,
 * virtual account could be partially created (some rails but not all), 
 * return status 400 for missing or invalid fields with invalidFields array,
 * status 404 for not found user, status 500 for internal server error
 * @param {*} userId 
 * @returns 
 */

exports.createBridgeVirtualAccount = async (userId) => {
	let invalidFields = []
	try {
		// check is bridge customer created
		let { data: user, error: user_error } = await supabase
			.from('bridge_customers')
			.select('bridge_id, status')
			.eq('user_id', userId)
			.maybeSingle();

		if (user_error) {
			throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, user_error.message, user_error);
		}
		if (!user) {
			throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.RECORD_NOT_FOUND, "User record not found");
		}
		if (user.status != BridgeCustomerStatus.active) {
			throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INACTIVE_USER, "User kyc/kyb is not yet passed");
		}

		// create default rail
		await Promise.all(
			defaultRail.map(async (rail) => {

				// get wallet address
				const address = getUserWallet(virtualAccountPaymentRailToChain[rail.destinationPaymentRail], userId)

				// check if virtual account is already created
				let { data: bridge_virtual_accounts, error: bridge_virtual_accounts_error } = await supabase
					.from('bridge_virtual_accounts')
					.select('id')
					.eq("user_id", userId)
					.eq("destination_wallet_address", address)
					.eq("destination_payment_rail", rail.destinationPaymentRail)
					.maybeSingle()

				if (bridge_virtual_accounts_error) {
					throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, bridge_virtual_accounts_error.message, bridge_virtual_accounts_error);
				}
				if (bridge_virtual_accounts) return

				// create virtual account
				const idempotencyKey = v4();
				const requestBody = {
					developer_fee_percent: developerFeePercent,
					source: {
						currency: rail.sourceCurrency,
						payment_rail: rail.sourcePaymentRail
					},
					destination: {
						currency: rail.destinationCurrency,
						payment_rail: rail.destinationPaymentRail,
						address: address,
					},
				}

				const response = await fetch(`${BRIDGE_URL}/v0/customers/${user.bridge_id}/virtual_accounts`, {
					method: 'POST',
					headers: {
						'Idempotency-Key': idempotencyKey,
						'Api-Key': BRIDGE_API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(requestBody)
				});

				const responseBody = await response.json()
				if (response.ok) {
					// insert virtual account record
					const { data: virtual_account, error: virtual_account_Error } = await supabase
						.from('bridge_virtual_accounts')
						.insert({
							user_id: userId,
							status: responseBody.status,
							source_currency: responseBody.source_deposit_instructions.currency,
							source_payment_rail: responseBody.source_deposit_instructions.payment_rail,
							destination_currency: responseBody.destination.currency,
							destination_payment_rail: responseBody.destination.payment_rail,
							destination_wallet_address: responseBody.destination.payment_rail.address,
							bridge_virtual_account_id: responseBody.id,
							developer_fee_percent: responseBody.developer_fee_percent,
							deposit_instructions_bank_name: responseBody.source_deposit_instructions.bank_name,
							deposit_instructions_bank_address: responseBody.source_deposit_instructions.bank_address,
							deposit_instructions_bank_routing_number: responseBody.source_deposit_instructions.bank_routing_number,
							deposit_instructions_bank_account_number: responseBody.source_deposit_instructions.bank_account_number,
							bridge_response: responseBody
						})
						.select()
				} else {
					if (response.code == 400) {
						invalidFields = Object.keys(responseBody.source.key).map((k) => k)
						throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INVALID_FIELD, "fileds are missing for creating virtual account", responseBody)
					} else {
						throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, "something went wrong when creating virtual account", responseBody)
					}
				}
			}))

		return {
			status: 200,
			invalidFields: [],
			message: "all virtual accounts create successfully"
		}

	} catch (error) {
		// logger 
		createLog("bridge/createVirtualAccount", userId, error.message, error.rawResponse)
		console.error(`Error happens in bridge/createVirtualAccount `, error)
		if (error.type == createBridgeVirtualAccountErrorType.INACTIVE_USER) {
			return {
				status: 403,
				invalidFields: [],
				message: error.message
			}
		} else if (error.type == createBridgeVirtualAccountErrorType.INVALID_FIELD) {
			return {
				status: 400,
				invalidFields,
				message: error.message
			}
		} else if (error.type == createBridgeVirtualAccountErrorType.RECORD_NOT_FOUND) {
			return {
				status: 404,
				invalidFields: [],
				message: error.message
			}
		} else if (error.type == createBridgeVirtualAccountErrorType.INTERNAL_ERROR) {
			return {
				status: 500,
				invalidFields: [],
				message: error.message
			}
		}
		return {
			status: 500,
			invalidFields: [],
			message: error.message
		}
	}


}