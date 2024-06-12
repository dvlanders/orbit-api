const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry")

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;
const CHECKBOOK_API_KEY = process.env.CHECKBOOK_API_KEY;
const CHECKBOOK_API_SECRET = process.env.CHECKBOOK_API_SECRET;


const createCheckbookErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS"
};

class createCheckbookError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, createCheckbookError.prototype);
	}
}


exports.createCheckbookUser = async (userId) => {
	let invalidFields = []
	try {
		const getUserInfo = () => supabase
			.from('user_kyc')
			.select('legal_first_name, legal_last_name')
			.eq('user_id', userId)
			.maybeSingle()

		const { data: user, error: userError } = await supabaseCall(getUserInfo)

		if (userError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, userError.message, userError)
		}
		if (!user) {
			throw new createCheckbookError(createCheckbookErrorType.RECORD_NOT_FOUND, "No user record found")
		}

		const requestBody = {
			"name": `${user.legal_first_name} ${user.legal_last_name}`,
			"user_id": userId
		}

		const response = await fetch(`${CHECKBOOK_URL}/user`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${CHECKBOOK_API_KEY}:${CHECKBOOK_API_SECRET}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		const responseBody = await response.json()

		if (response.ok) {
			const { error: checkbookUserError } = await supabase
				.from('checkbook_users')
				.insert({
					checkbook_user_id: userId,
					checkbook_id: responseBody.id,
					api_key: responseBody.key,
					api_secret: responseBody.secret,
					name: requestBody.name,
					user_id: userId,
					checkbook_response: responseBody
				});

			if (checkbookUserError) {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookUserError.message, checkbookUserError)
			}

			return {
				status: 200,
				invalidFields: [],
				message: "Checkbook user created successfully",
				customerStatus: "active"
			}

		} else {
			if (response.status == 400 && responseBody.more_info.name) {
				throw new createCheckbookError(createCheckbookErrorType.INVALID_FIELD, "Name is missing or invalid", responseBody)
			} else if (response.status == 400 && responseBody.error == "User already exists") {
				// fetch the created user
				const response = await fetch(`${CHECKBOOK_URL}/user/list?page=1&per_page=10&q=${userId}`, {
					headers: {
						'Accept': 'application/json',
						'Authorization': `${CHECKBOOK_API_KEY}:${CHECKBOOK_API_SECRET}`,
					}
				})
				// successfully getch record
				const responseBody = await response.json()
				if (response.ok && responseBody.total == 1) {
					// todo refetch user key and secret
				}
				throw new createCheckbookError(createCheckbookErrorType.USER_ALREADY_EXISTS, "User is already exists", responseBody)
			} else {
				throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbook_user_error.error || "unknown error", responseBody)
			}
		}


	} catch (error) {
		createLog("user/util/createCheckbookUser", userId, error.message, error)
		if (error.type == createCheckbookErrorType.INVALID_FIELD) {
			return {
				status: 400,
				invalidFields: ["legal_first_name", "legal_last_name"],
				message: error.message,
				customerStatus: "inactive"
			}
		} else if (error.type == createCheckbookErrorType.USER_ALREADY_EXISTS) {
			return {
				status: 400,
				invalidFields: [],
				message: error.message,
				customerStatus: "inactive"
			}
		} else if (error.type == createCheckbookErrorType.RECORD_NOT_FOUND) {
			return {
				status: 404,
				invalidFields: [],
				message: error.message,
				customerStatus: "inactive"
			}
		} else {
			return {
				status: 500,
				invalidFields: [],
				message: "Unexpected error happened, please contact HIFI for more information",
				customerStatus: "inactive"
			}
		}
	}
}