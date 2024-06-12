const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const { createLog } = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;
const CHECKBOOK_API_KEY = process.env.CHECKBOOK_API_KEY;
const CHECKBOOK_API_SECRET = process.env.CHECKBOOK_API_SECRET;


const createCheckbookErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_PROCESSOR_TOKEN: "INVALID_PROCESSOR_TOKEN",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	UNAUTHORIZED: "UNAUTHORIZED"
};

class createCheckbookError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createBridgeCustomerError.prototype);
	}
}


exports.createCheckbookBankAccount = async (userId, accountType, processorToken, bankName, accountNumber, routingNumber) => {
	let invalidFields = []
	try {
		// get the user's api key and api secret from the checkbook_users table
		const { data: checkbookUserData, error: checkbookUserError } = await await supabaseCall(() => supabase
			.from('checkbook_users')
			.select('api_key, api_secret')
			.eq('user_id', userId)
			.maybeSingle()
		);

		if (checkbookUserError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookUserError.message, checkbookUserError)
		}
		if (!checkbookUserData.api_key || !checkbookUserData.api_secret) {
			throw new createCheckbookError(createCheckbookErrorType.RECORD_NOT_FOUND, "No user record found for ach pull. Please create a user first.")
		}

		// save the checkbook account details immediately
		const { data: checkbookAccountData, error: checkbookAccountError } = await supabase
			.from('checkbook_accounts')
			.insert({
				user_id: userId,
				account_type: accountType,
				processor_token: processorToken,
				bank_name: bankName,
				routing_number: routingNumber,
				account_number: accountNumber
			})
			.select();

		if (checkbookAccountError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountError.message, checkbookAccountError)
		}

		// make the call to the checkbook endpoint with the processor token
		const requestBody = {
			"processor_token": processorToken,
		}

		const response = await fetch(`${CHECKBOOK_URL}/account/bank/iav/plaid`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUserData.api_key}:${checkbookUserData.api_secret}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		const checkbookData = await response.json()

		// happy path
		if (response.ok) {


			// store the response and checkbook_account_id in the checkbook_accounts table
			const { error: checkbookAccountUpdateError } = await supabase
				.from('checkbook_accounts')
				.update({
					checkbook_response: response,

				})
				.eq('user_id', userId);

			if (checkbookAccountUpdateError) {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountUpdateError.message, checkbookAccountUpdateError)
			}

			return {
				status: 200,
				invalidFields: [],
				message: "Bank account added successfully",
				id: checkbookAccountData.id
			}

		} else {
			if (checkbookData.error == "Unauthorized") {
				throw new createCheckbookError(createCheckbookErrorType.UNAUTHORIZED, checkbookData.message, checkbookData)
			} else if (checkbookData.error == "Invalid processor token") {
				throw new createCheckbookError(createCheckbookErrorType.INVALID_PROCESSOR_TOKEN, checkbookData.message, checkbookData)
			} else {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbook_user_error.error || "unknown error", checkbookData)
			}
		}


	} catch (error) {
		if (error.type == createCheckbookErrorType.UNAUTHORIZED) {
			return {
				status: 400,
				invalidFields: [],
				message: error.message
			}
		} else if (error.type == createCheckbookErrorType.INVALID_PROCESSOR_TOKEN) {
			return {
				status: 400,
				invalidFields: ["processor_token"],
				message: error.message
			}
		} else if (error.type == createCheckbookErrorType.INTERNAL_ERROR) {
			return {
				status: 404,
				invalidFields: [],
				message: error.message
			}
		} else {
			return {
				status: 500,
				invalidFields: [],
				message: error.message
			}
		}
	}
}
