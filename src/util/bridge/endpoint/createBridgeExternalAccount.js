const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const { createLog } = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")
const { BridgeCustomerStatus } = require("../utils");



const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeExternalAccountErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	INACTIVE_USER: "INACTIVE_USER",
};

class createBridgeExternalAccountError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createBridgeCustomerError.prototype);
	}
}



exports.createBridgeExternalAccount = async (
	userId, accountType, currency, bankName, accountOwnerName, accountOwnerType,
	beneficiaryFirstName, beneficiaryLastName, beneficiaryBusinessName,
	beneficiaryStreetLine1, beneficiaryStreetLine2, beneficiaryCity, beneficiaryStateCode, beneficiaryPostalCode, beneficiaryCountryCode,
	ibanAccountNumber, businessIdentifierCode, bankCountryCode, accountNumber, routingNumber
) => {

	try {
		// check if bridge customer created
		const { data: bridgeCustomerData, error: bridgeCustomerError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.select('bridge_id, status')
			.eq('user_id', userId)
			.maybeSingle()
		);



		if (bridgeCustomerError) {
			console.error('bridgeCustomerError', bridgeCustomerError);
			return {
				status: 500,
				type: createBridgeExternalAccountErrorType.INTERNAL_ERROR,
				message: bridgeCustomerError.message,
				rawResponse: bridgeCustomerError
			};
		}
		if (!bridgeCustomerData) {
			console.error('bridgeCustomerData', bridgeCustomerData);
			return {
				status: 404,
				type: createBridgeExternalAccountErrorType.RECORD_NOT_FOUND,
				message: "userId not found"
			};
		}
		if (bridgeCustomerData.status !== BridgeCustomerStatus.ACTIVE) {
			console.error('bridgeCustomerData', bridgeCustomerData);
			return {
				status: 403,
				type: createBridgeExternalAccountErrorType.INACTIVE_USER,
				message: "User KYC/KYB is not yet passed"
			};
		}
		// create external account
		const idempotencyKey = v4();
		const bodyObject = {
			account_type: accountType,
			currency: currency,
			bank_name: bankName,
			account_owner_name: accountOwnerName,
			account_owner_type: accountOwnerType,
		};

		if (ibanAccountNumber && businessIdentifierCode && bankCountryCode) {
			bodyObject.iban = {
				account_number: ibanAccountNumber,
				bic: businessIdentifierCode,
				country: bankCountryCode
			};
		}

		if (accountOwnerType === 'individual') {
			bodyObject.first_name = beneficiaryFirstName;
			bodyObject.last_name = beneficiaryLastName;
		} else if (accountOwnerType === 'business') {
			bodyObject.business_name = beneficiaryBusinessName;
		}

		if (accountNumber && routingNumber) {
			bodyObject.account = {
				account_number: accountNumber,
				routing_number: routingNumber
			};
			bodyObject.address = {
				street_line_1: beneficiaryStreetLine1,
				street_line_2: beneficiaryStreetLine2,
				city: beneficiaryCity,
				state: beneficiaryStateCode,
				postal_code: beneficiaryPostalCode,
				country: beneficiaryCountryCode
			};
		}


		const bridgeResponse = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeCustomerData.bridge_id}/external_accounts`, {
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey,
				'Api-Key': BRIDGE_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(bodyObject)
		});

		const bridgeData = await bridgeResponse.json();


		// happy path
		if (bridgeResponse.ok) {
			return {
				status: 200,
				invalidFields: [],
				message: "Bank account created successfully",
				rawResponse: bridgeData
			};
		} else if (bridgeResponse.status == 403){
			// for user that not yet approved for off ramp in EU
			return {
				status: 400,
				type: createBridgeExternalAccountErrorType.INACTIVE_USER,
				message: "Please review and complete the listed requirements to gain access to the SEPA/Euro services.",
				source: bridgeData.source,
				rawResponse: bridgeData
			};
		} else if (bridgeResponse.status == 400){
			return {
				status: 400,
				type: createBridgeExternalAccountErrorType.INVALID_FIELD,
				message: "Please resubmit the following parameters that are either missing or invalid",
				source: bridgeData.source,
				rawResponse: bridgeData
			};
		}
		else {
			return {
				status: bridgeResponse.status,
				type: createBridgeExternalAccountErrorType.INTERNAL_ERROR,
				message: bridgeData.message,
				source: bridgeData.source,
				rawResponse: bridgeData
			};
		}

	} catch (error) {
		// logger 
		createLog("bridge/createBridgeExternalAccount", userId, error.message, error.rawResponse);
		console.error(`Error occurred in bridge/createBridgeExternalAccount `, error);
		return {
			status: 500,
			type: createBridgeExternalAccountErrorType.INTERNAL_ERROR,
			message: error.message,
			rawResponse: error
		};
	}
};
