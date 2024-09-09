const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const { BridgeCustomerStatus, virtualAccountPaymentRailToChain } = require("../utils");
const  createLog  = require("../../logger/supabaseLogger");
const {getAddress} = require("ethers");
const { supabaseCall } = require("../../supabaseWithRetry");
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
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

const createBridgeVirtualAccount = async(userId, bridgeId, rail) => {
	// get wallet address
	const {walletAddress: address} = await getBastionWallet(userId, virtualAccountPaymentRailToChain[rail.destinationPaymentRail])
	if (!address) throw new Error (`No user wallet found`)

	// upsert virtual account record, if fail to upsert since there is conflict, select will return no record
	let { data: baseVirtualAccount, error: baseVirtualAccountError } = await supabaseCall(() => supabase
	.from('bridge_virtual_accounts')
	.upsert({
		user_id: userId,
		source_currency: rail.sourceCurrency,
		source_payment_rails: rail.sourcePaymentRails,
		destination_currency: rail.destinationCurrency,
		destination_payment_rail: rail.destinationPaymentRail,
	}, { onConflict: 'user_id, source_currency, source_payment_rails, destination_currency, destination_payment_rail', ignoreDuplicates: true })
	.select()
	.maybeSingle())

	if(baseVirtualAccountError) throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, baseVirtualAccountError.message, baseVirtualAccountError);

	if(!baseVirtualAccount){
		console.log("baseVirtualAccount not found, which means race condition detected")
		let { data: bridgeVirtualAccount, error: bridgeVirtualAccountError } = await supabase
		.from('bridge_virtual_accounts')
		.select('*')
		.match({user_id: userId, destination_payment_rail: rail.destinationPaymentRail, source_currency: rail.sourceCurrency, destination_currency: rail.destinationCurrency})
		.contains('source_payment_rails', JSON.stringify(rail.sourcePaymentRails))
		.maybeSingle()

		if (bridgeVirtualAccountError) throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, bridgeVirtualAccountError.message, bridgeVirtualAccountError);

		if (!bridgeVirtualAccount) throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.RECORD_NOT_FOUND, "No virtual account found", bridgeVirtualAccount);

		// baseVirtualAccount = bridgeVirtualAccount;
		return {virtualAccount:bridgeVirtualAccount , alreadyExisted: true}
	}

	// only return here when the base virtual account also has an associate virtual account id
	// if(baseVirtualAccount && baseVirtualAccount.virtual_account_id) return baseVirtualAccount;

	// create virtual account
	const idempotencyKey = v4();
	const requestBody = {
		developer_fee_percent: developerFeePercent,
		source: {
			currency: rail.sourceCurrency,
		},
		destination: {
			currency: rail.destinationCurrency,
			payment_rail: rail.destinationPaymentRail,
			address: address,
		},
	}

	const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}/virtual_accounts`, {
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
		const { data: virtualAccount, error: virtualAccountError } = await supabaseCall(() => supabase
			.from('bridge_virtual_accounts')
			.update({
				user_id: userId,
				status: responseBody.status,
				source_currency: responseBody.source_deposit_instructions.currency,
				source_payment_rail: responseBody.source_deposit_instructions.payment_rail, // deprecated
				source_payment_rails: responseBody.source_deposit_instructions.payment_rails,
				destination_currency: responseBody.destination.currency,
				destination_payment_rail: responseBody.destination.payment_rail,
				destination_wallet_address: getAddress(responseBody.destination.address),
				virtual_account_id: responseBody.id,
				developer_fee_percent: responseBody.developer_fee_percent,
				deposit_institutions_bank_name: responseBody.source_deposit_instructions.bank_name,
				deposit_institutions_bank_address: responseBody.source_deposit_instructions.bank_address,
				deposit_institutions_bank_routing_number: responseBody.source_deposit_instructions.bank_routing_number,
				deposit_institutions_bank_account_number: responseBody.source_deposit_instructions.bank_account_number,
				bridge_response: responseBody
			})
			.eq('id', baseVirtualAccount.id)
			.select()
			.single())
		if (virtualAccountError) throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, virtualAccountError.message, virtualAccountError)
		return {virtualAccount, alreadyExisted: false}
	} else {
		throw new createBridgeVirtualAccountError(createBridgeVirtualAccountErrorType.INTERNAL_ERROR, "something went wrong when creating virtual account", responseBody)
	}
}


module.exports = {
	createBridgeVirtualAccount,
	createBridgeVirtualAccountError
}