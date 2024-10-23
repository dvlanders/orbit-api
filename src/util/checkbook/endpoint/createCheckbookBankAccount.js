const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const { createLog } = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")
const { insertAccountProviders, fetchAccountProvidersWithInternalId } = require("../../account/accountProviders/accountProvidersService")
const { fetchWithLogging } = require("../../logger/fetchLogger");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;


const createCheckbookErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_PROCESSOR_TOKEN: "INVALID_PROCESSOR_TOKEN",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	PLAID_TOKEN_CREATION_ERROR: "PLAID_TOKEN_CREATION_ERROR",
	UNAUTHORIZED: "UNAUTHORIZED"
};

class createCheckbookError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createCheckbookError.prototype);
	}
}


exports.createCheckbookBankAccountWithProcessorToken = async (userId, accountType, processorToken, bankName) => {
	try {
		// check if the account already existed
		const { data: checkbokAccount, error: checkbookAccountError } = await supabaseCall(() => supabase
			.from("checkbook_accounts")
			.select("*")
			.eq("user_id", userId)
			.eq("processor_token", processorToken)
			.maybeSingle()
		)

		if (checkbookAccountError) throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountError.message, checkbookAccountError)
		if (checkbokAccount) {
			const account = await fetchAccountProvidersWithInternalId(checkbokAccount.id);
			if(account.length > 0) {
				return {
					status: 200,
					invalidFields: [],
					message: "Bank account already added",
					id: account[0].id
				}
			}else{
				const account = await insertAccountProviders(checkbokAccount.id, "usd", "onramp", "ach", "CHECKBOOK", userId)
				return {
					status: 200,
					invalidFields: [],
					message: "Bank account already added",
					id: account.id
				}
			}
		}

		// get the user's api key and api secret from the checkbook_users table
		const { data: checkbookUserData, error: checkbookUserError } = await supabaseCall(() => supabase
			.from('checkbook_users')
			.select('api_key, api_secret, checkbook_user_id')
			.eq('user_id', userId)
			.eq("type", "SOURCE")
			.maybeSingle()
		);


		if (checkbookUserError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookUserError.message, checkbookUserError)

		}
		if (!checkbookUserData || !checkbookUserData.api_key || !checkbookUserData.api_secret) {
			throw new createCheckbookError(createCheckbookErrorType.RECORD_NOT_FOUND, "No user record found for ach pull. Please create a user first.")
		}

		// make the call to the checkbook endpoint with the processor token
		const requestBody = {
			"processor_token": processorToken,
		}


		const response = await fetchWithLogging(`${CHECKBOOK_URL}/account/bank/iav/plaid`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUserData.api_key}:${checkbookUserData.api_secret}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		const plaidAccountData = await response.json()
		// happy path
		if (response.ok) {

			const { account, routing, name } = plaidAccountData.accounts[0];
			// create checkbook account
			const checkbookAccountResponse = await fetchWithLogging(`${CHECKBOOK_URL}/account/bank`, {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Authorization': `${checkbookUserData.api_key}:${checkbookUserData.api_secret}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					account: account,
					name: name,
					routing: routing,
					type: accountType
				})
			});
			const checkbookAccountResponseBody = await checkbookAccountResponse.json();
			if (!checkbookAccountResponse.ok) {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountResponseBody.error || "unknown error", checkbookAccountResponseBody)
			}
			const { data: checkbookAccountData, error: checkbookAccountError } = await supabase
				.from('checkbook_accounts')
				.insert({
					checkbook_response: checkbookAccountResponseBody,
					checkbook_id: checkbookAccountResponseBody.id,
					checkbook_status: checkbookAccountResponseBody.status,
					account_number: checkbookAccountResponseBody.account,
					routing_number: checkbookAccountResponseBody.routing,
					user_id: userId,
					account_type: accountType,
					processor_token: processorToken,
					bank_name: bankName,
					connected_account_type: "PLAID",
					plaid_account_data_response: plaidAccountData,
					checkbook_user_id: checkbookUserData.checkbook_user_id
				})
				.select("*")
				.single()
			if (checkbookAccountError) throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountError.message, checkbookAccountError)

			accountProviderRecord = await insertAccountProviders(checkbookAccountData.id, "usd", "onramp", "ach", "CHECKBOOK", userId)
			return {
				status: 200,
				invalidFields: [],
				message: "Bank account added successfully",
				id: accountProviderRecord.id
			}

		} else {
			if (plaidAccountData.error == "Unauthorized") {
				throw new createCheckbookError(createCheckbookErrorType.UNAUTHORIZED, plaidAccountData.message)
			} else if (plaidAccountData.error == "Invalid processor token") {
				throw new createCheckbookError(createCheckbookErrorType.INVALID_PROCESSOR_TOKEN, plaidAccountData.message)
			} else if (plaidAccountData.error == "Oops, something went wrong"){ // this is temporary until checkbook fix this
				throw new createCheckbookError(createCheckbookErrorType.PLAID_TOKEN_CREATION_ERROR, "Plaid processor token creation error, possibly due to an expired token.")
			} else {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, plaidAccountData.error || "unknown error", plaidAccountData)
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
		} else if (error.type == createCheckbookErrorType.PLAID_TOKEN_CREATION_ERROR) {
			return {
				status: 500,
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
exports.createCheckbookBankAccountForVirtualAccount = async (checkbookUserId, virtualAccountId, accountNumber, routingNumber) => {
	try {
		// check if a checkbook account record already exists for this virtual account
		const { data: existingCheckbookAccountData, error: existingCheckbookAccountError } = await supabase
			.from('checkbook_accounts')
			.select()
			.eq('bridge_virtual_account_id', virtualAccountId)
			.neq('checkbook_id', null)
			.maybeSingle();

		if (existingCheckbookAccountError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, existingCheckbookAccountError.message, existingCheckbookAccountError)
		}

		// get the user's api key and api secret from the checkbook_users table
		const { data: checkbookUserData, error: checkbookUserError } = await supabaseCall(() => supabase
			.from('checkbook_users')
			.select('api_key, api_secret, checkbook_user_id')
			.eq('checkbook_user_id', checkbookUserId)
			.eq("type", "DESTINATION")
			.maybeSingle()
		);

		if (checkbookUserError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookUserError.message, checkbookUserError)

		}
		if (!checkbookUserData || !checkbookUserData.api_key || !checkbookUserData.api_secret) {
			throw new createCheckbookError(createCheckbookErrorType.RECORD_NOT_FOUND, "No user record found for ach pull. Please create a user first.")
		}



		// make the call to the checkbook bank account creation endpoint
		const requestBody = {
			"account": accountNumber,
			"name": virtualAccountId,
			"routing": routingNumber,
			"type": "CHECKING",
		}
		const response = await fetchWithLogging(`${CHECKBOOK_URL}/account/bank`, {
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
					checkbook_response: checkbookData,
					checkbook_id: checkbookData.id,
					checkbook_user_id: checkbookUserId
				})
				.eq('bridge_virtual_account_id', virtualAccountId)

			if (checkbookAccountUpdateError) {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookAccountUpdateError.message, checkbookAccountUpdateError)
			}

			return {
				status: 200,
				invalidFields: [],
				message: "Bank account added successfully",
			}

		} else {
			console.error(checkbookData)
			if (checkbookData.error == "Unauthorized") {
				throw new createCheckbookError(createCheckbookErrorType.UNAUTHORIZED, checkbookData.message, checkbookData)
			} else {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookData.error || "unknown error", checkbookData)
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
