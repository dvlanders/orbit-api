const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")
const { BridgeCustomerStatus } = require("../utils");
const { getAddress } = require("ethers")
const { fetchWithLogging } = require("../../logger/fetchLogger");


const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeExternalAccountErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INACTIVE_USER: "INACTIVE_USER"
};


exports.createBridgeLiquidationAddress = async (
	userId, externalAccountId, destinationPaymentRail, destinationCurrency
) => {
	try {

		const { data: userData, error: userError } = await supabase
			.from('bridge_customers')
			.select('bridge_id, status')
			.eq('user_id', userId)
			.maybeSingle();

		const { data: externalAccountData, error: externalAccountError } = await supabase
			.from('bridge_external_accounts')
			.select('bridge_external_account_id')
			.eq('id', externalAccountId)
			.maybeSingle();



		// create liquidation address
		const idempotencyKey = v4();
		const requestBody = {
			chain: "polygon",
			currency: "usdc",
			external_account_id: externalAccountData.bridge_external_account_id,
			destination_payment_rail: destinationPaymentRail,
			destination_currency: destinationCurrency
		}


		const response = await fetchWithLogging(`${BRIDGE_URL}/v0/customers/${userData.bridge_id}/liquidation_addresses`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		}, "BRIDGE");

		const responseJson = await response.json();

		if (!response.ok) {
			throw new Error(JSON.stringify(responseJson));
		}

		// insert the liquidation address into the database
		const { data: liquidationAddress, error: liquidationAddressError } = await supabase
			.from('bridge_liquidation_addresses')
			.insert(
				{
					id: idempotencyKey,
					chain: "polygon",
					currency: "usdc",
					destination_sepa_reference: responseJson.destination_sepa_reference,
					liquidation_address_id: responseJson.id,
					external_account_id: externalAccountId,
					destination_payment_rail: destinationPaymentRail,
					destination_currency: destinationCurrency,
					address: process.env.NODE_ENV == "development" ? responseJson.address : getAddress(responseJson.address),

				}
			);


		if (liquidationAddressError) {
			throw new Error(JSON.stringify(liquidationAddressError));
		}

		return {
			status: 200,
			rawResponse: responseJson
		};

	} catch (error) {
		// logger 
		await createLog("bridge/createBridgeLiquidationAddress", userId, error.message, error);
		console.error(`Error occurred in bridge/createBridgeExternalAccount `, error);
		return {
			status: 500,
			type: createBridgeExternalAccountErrorType.INTERNAL_ERROR,
			message: error.message,
			rawResponse: error
		};
	}
};
