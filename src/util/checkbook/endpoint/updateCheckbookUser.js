const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry")
const { CustomerStatus } = require("../../user/common.js");
const { createCheckbookUser } = require("./createCheckbookUser.js");

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const UpdateCheckbookUserErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_ACCOUNT: "INVALID_ACCOUNT",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class UpdateCheckbookUserError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, UpdateCheckbookUserError.prototype);
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
        throw new UpdateCheckbookUserError(UpdateCheckbookUserErrorType.INVALID_ACCOUNT, responseBody.message, responseBody)

    }else{
        throw new UpdateCheckbookUserError(UpdateCheckbookUserErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
    }
}

const updateCheckbookUser = async(userId) => {
    try {
        // check user bridge kyc status 
        let { data: checkbookUsers, error: checkcookUsersError } = await supabaseCall(() => supabase
        .from('checkbook_users')
        .select('api_key, api_secret')
        .eq("user_id", userId)
        )

        if (checkcookUsersError) throw new UpdateCheckbookUserError(UpdateCheckbookUserErrorType.INTERNAL_ERROR, checkcookUsersError.message, checkcookUsersError)
        if (!checkbookUsers || checkbookUsers.length < 1) {
            // create a new checkbook user
            return await createCheckbookUser(userId)
        }

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
        
    }catch(error){
        //  log
		createLog("user/util/updateCheckbookUser", userId, error.message, error.rawResponse)
		// process error
		if (error.type == UpdateCheckbookUserErrorType.INTERNAL_ERROR) {
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


module.exports = {
    updateCheckbookUser
}

