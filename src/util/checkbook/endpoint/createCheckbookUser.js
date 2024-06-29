const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const createLog = require("../../logger/supabaseLogger");
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");

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

const create = async (user, user_id, checkbook_user_id, type) => {
	// check is checkbook user already created
	let { data: checkbookUser, error: checkbookUserError } = await supabaseCall(() => supabase
		.from('checkbook_users')
		.select('id')
		.eq("checkbook_user_id", checkbook_user_id)
		.maybeSingle())
	
	if (checkbookUserError) throw checkbookUserError
	if (checkbookUser) return
		
	const requestBody = {
		"name": `${user.legal_first_name} ${user.legal_last_name}`,
		"user_id": checkbook_user_id
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
			.upsert({
				checkbook_user_id: responseBody.user_id,
				checkbook_id: responseBody.id,
				api_key: responseBody.key,
				api_secret: responseBody.secret,
				name: requestBody.name,
				user_id: user_id,
				checkbook_response: responseBody,
				type
			}, {onConflict: "checkbook_user_id"});

		if (checkbookUserError) {
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, checkbookUserError.message, checkbookUserError)
		}

		return 
	} else {
		if (response.status == 400 && responseBody.more_info && responseBody.more_info.name) {
			throw new createCheckbookError(createCheckbookErrorType.INVALID_FIELD, "Name is missing or invalid", responseBody)
		} else if (response.status == 400 && responseBody.error == "User already exists") {
			// fetch the created user
			const response = await fetch(`${CHECKBOOK_URL}/user/list?page=1&per_page=10&q=${user_id}`, {
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
			throw new createCheckbookError(createCheckbookErrorType.INTERNAL_ERROR, responseBody.error || "unknown error", responseBody)
		}
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

		// create source checkbook user
		await create(user, userId, userId, "SOURCE")
		// create destination checkbook user
		await create(user, userId, `${userId}-destination`, "DESTINATION")


		return {
			status: 200,
			usOnRamp:  {
				status: CustomerStatus.ACTIVE,
				actions: [],
				fields: []
			},
			message: ""
		}


	} catch (error) {
		createLog("user/util/createCheckbookUser", userId, error.message, error)
		if (error.type == createCheckbookErrorType.INVALID_FIELD) {
			return {
                status: 200,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: ["update"],
                    fields: ["legal_first_name", "legal_last_name"]
                },
                message: "please update the information"
            }
		} else if (error.type == createCheckbookErrorType.USER_ALREADY_EXISTS) {
			return {
                status: 500,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: [],
                    fields: []
                },
                message: "please contact HIFI for more information"
            }
		} else if (error.type == createCheckbookErrorType.RECORD_NOT_FOUND) {
			return {
                status: 500,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: [],
                    fields: []
                },
                message: "please contact HIFI for more information"
            }
		} else {
			return {
                status: 500,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: [],
                    fields: []
                },
                message: "please contact HIFI for more information"
            }
		}
	}
}