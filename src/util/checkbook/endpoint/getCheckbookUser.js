const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { createCheckbookUser } = require("./createCheckbookUser");
const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const CustomerStatus = {
    INACTIVE: "INACTIVE",
    ACTIVE: "ACTIVE",
}

const GetCheckbookUserErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
    INVALID_ACCOUNT: "INVALID_ACCOUNT"
};

class GetCheckbookUserError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, GetCheckbookUserError.prototype);
	}
}

const getCheckbookUser = async(userId) => {
    // get user spi key and secret
    try {
        let { data: checkbookUser, error: checkcookUserError } = await supabaseCall(() => supabase
        .from('checkbook_users')
        .select('api_key, api_secret')
        .eq("user_id", userId)
        .maybeSingle())

        if (checkcookUserError) throw new GetCheckbookUserError(GetCheckbookUserErrorType.INTERNAL_ERROR, checkcookUserError.message, checkcookUserError)
        if (!checkbookUser) {
            // try to create one if no record found
            const checkbookUserResult = await createCheckbookUser(userId)
            if (checkbookUserResult.status == 200){
                return {
                    status: 200,
                    invalidFields: [],
                    usOnRamp: CustomerStatus.ACTIVE,
                    message: ""
                }
            }else{
                return {
                    status: checkbookUserResult.status,
                    invalidFields: checkbookUserResult.invalidFields,
                    usOnRamp: CustomerStatus.INACTIVE,
                    message: checkbookUserResult.message
                }
            }
        }

        // check if the api key and api secret is valid
		const response = await fetch(`${CHECKBOOK_URL}/user`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': `${checkbookUser.api_key}:${checkbookUser.api_secret}`,
				'Content-Type': 'application/json'
			},
		}); 
        const responseBody = await response.json()
        if (response.ok){
            return {
                status: 200,
                invalidFields: [],
                usOnRamp: CustomerStatus.ACTIVE,
                message: ""
            }
        }else if (response.status == 400){
            throw new GetCheckbookUserError(GetCheckbookUserErrorType.INVALID_ACCOUNT, responseBody.message, responseBody)

        }else{
            throw new GetCheckbookUserError(GetCheckbookUserErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
        }



    }catch (error){
        createLog("user/util/getCheckbookUser", userId, error.message, error.rawResponse)
        if (error.type == GetCheckbookUserErrorType.INTERNAL_ERROR){
            return {
                status: 500,
                invalidFields: [],
                usOnRamp: CustomerStatus.INACTIVE,
                message: "please contact HIFI for more information"
            }
        }else if (error.type == GetCheckbookUserErrorType.INVALID_ACCOUNT){
            return {
                status: 400,
                invalidFields: [],
                usOnRamp: CustomerStatus.INACTIVE,
                message: "please call user/update to reactivate"
            }
        }

        return {
            status: 500,
            invalidFields: [],
            usOnRamp: CustomerStatus.INACTIVE,
            message: "please contact HIFI for more information"
        }

    }



}