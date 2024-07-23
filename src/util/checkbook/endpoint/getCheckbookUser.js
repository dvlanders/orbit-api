const createLog = require("../../logger/supabaseLogger");
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry");
const { CustomerStatus } = require("../../user/common");
const { createCheckbookUser } = require("./createCheckbookUser");
const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

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

const checkUserApiKeyPairsHealth = async(checkbook_user) => {
    // check if the api key and api secret is valid
    const response = await fetch(`${CHECKBOOK_URL}/user`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `${checkbook_user.api_key}:${checkbook_user.api_secret}`,
            'Content-Type': 'application/json'
        },
    }); 
    const responseBody = await response.json()
    if (response.ok){
        return
    }else if (response.status == 400){
        throw new GetCheckbookUserError(GetCheckbookUserErrorType.INVALID_ACCOUNT, responseBody.message, responseBody)

    }else{
        throw new GetCheckbookUserError(GetCheckbookUserErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
    }
}

/**
 * return 
 * status: 200, 400, 500, 404   
 * usOnRamp: object   
 * status: 200 for created user
 * status: 400 for invalid user (invalid key secret) 
 * status: 404 for possibly unsubmit application  
 * status: 500 for internal server error  
 * @param {*} userId 
 * @returns 
 */
const getCheckbookUser = async(userId) => {
    // get user spi key and secret
    try {
        let { data: checkbookUsers, error: checkcookUserError } = await supabaseCall(() => supabase
        .from('checkbook_users')
        .select('api_key, api_secret')
        .eq("user_id", userId)
        )

        if (checkcookUserError) throw new GetCheckbookUserError(GetCheckbookUserErrorType.INTERNAL_ERROR, checkcookUserError.message, checkcookUserError)
        if (!checkbookUsers) throw new GetCheckbookUserError(GetCheckbookUserErrorType.RECORD_NOT_FOUND, "No checkbook user found")
        if (checkbookUsers.length < 1 ) throw new GetCheckbookUserError(GetCheckbookUserErrorType.INVALID_ACCOUNT, "Checkbook user is created falsefully")

        // check if the api key and api secret is valid
		await Promise.all(checkbookUsers.map(async(checkbookUser) => await checkUserApiKeyPairsHealth(checkbookUser)))

        return {
            status: 200,
            usOnRamp:  {
                status: CustomerStatus.ACTIVE,
                actions: [],
                fields: []
            },
            message: ""
        }



    }catch (error){
        await createLog("user/util/getCheckbookUser", userId, error.message, error.rawResponse)
        if (error.type == GetCheckbookUserErrorType.INTERNAL_ERROR){
            return {
                status: 500,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: [],
                    fields: []
                },
                message: "please contact HIFI for more information"
            }
        }else if (error.type == GetCheckbookUserErrorType.INVALID_ACCOUNT){
            return {
                status: 200,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: ["update"],
                    fields: []
                },
                message: "please call user/update to reactivate"
            }
        }else if (error.type == GetCheckbookUserErrorType.RECORD_NOT_FOUND){
            return {
                status: 200,
                usOnRamp:  {
                    status: CustomerStatus.INACTIVE,
                    actions: ["update"],
                    fields: []
                },
                message: "please call user/update to reactivate"
            }
        }

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

module.exports = getCheckbookUser