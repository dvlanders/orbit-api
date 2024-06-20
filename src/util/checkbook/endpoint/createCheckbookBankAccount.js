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


exports.createCheckbookBankAccountWithProcessorToken = async (userId, accountType, processorToken, bankName, accountNumber, routingNumber) => {
	try {
		// get the user's api key and api secret from the checkbook_users table
		const { data: checkbookUserData, error: checkbookUserError } = await supabaseCall(() => supabase
			.from('checkbook_users')
			.select('api_key, api_secret')
			.eq('user_id', userId)
			.maybeSingle()
		);

		console.log('checkbookUserData', checkbookUserData)

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
		console.log('******checkbookData', checkbookData)
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
				throw new createCheckbookError(createCheckbookErrorType.UNAUTHORIZED, checkbookData.message)
			} else if (checkbookData.error == "Invalid processor token") {
				throw new createCheckbookError(createCheckbookErrorType.INVALID_PROCESSOR_TOKEN, checkbookData.message)
			} else {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbook_user_error.error || "unknown error", checkbookData)
			}
		}


	} catch (error) {

		console.log('error', error)
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
				message: "Unknown error, please send a screenshot of this request to developers@hifibridge.com"
			}
		}
	}
}

// Creates a checkbook bank account for a virtual account under a hardcoded central checkbook user account which holds all the checkbook accounts for virtual accounts
// TODO: finish creating this util function and implement it into the poll Bridge3 customer status thing after the bridge virtual account gets created
exports.createCheckbookBankAccountForVirtualAccount = async (userId, virtualAccountId, accountNumber, routingNumber) => {
	try {
		// check if a checkbook account record already exists for this virtual account
		const { data: existingCheckbookAccountData, error: existingCheckbookAccountError } = await supabase
			.from('checkbook_accounts')
			.select()
			.eq('bridge_virtual_account_id', virtualAccountId)
			.maybeSingle();

		if (existingCheckbookAccountError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, existingCheckbookAccountError.message, existingCheckbookAccountError)
		}



		// make the call to the checkbook bank account creation endpoint
		const requestBody = {
			"account": accountNumber,
			"name": virtualAccountId,
			"routing": routingNumber,
			"type": "CHECKING",
		}

		const response = await fetch(`${CHECKBOOK_URL}/account/bank`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${process.env.CHECKBOOK_CENTRAL_USER_API_KEY}:${process.env.CHECKBOOK_CENTRAL_USER_API_SECRET}`,
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
