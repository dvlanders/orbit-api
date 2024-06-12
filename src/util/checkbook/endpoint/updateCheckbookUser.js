const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry")
const {createCheckbbokUser} = require("./createCheckbookUser")
const {getCheckbookUser} = require("./getCheckbookUser")
const { CustomerStatus } = require("../../user/common.js");

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

const updateCheckbookUser = async(userId) => {
    try {
        // check user bridge kyc status 
        let { data: checkbookUser, error: checkcookUserError } = await supabaseCall(() => supabase
        .from('checkbook_users')
        .select('api_key, api_secret')
        .eq("user_id", userId)
        .maybeSingle())

        if (checkcookUserError) throw new UpdateCheckbookUserError(UpdateCheckbookUserErrorType.INTERNAL_ERROR, checkcookUserError.message, checkcookUserError)
        if (!checkbookUser) {
            // create a new checkbook user
            return await createCheckbbokUser(userId)
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
            // valid api key & secret
            return {
                status: 200,
                usOnRamp:  {
                    status: CustomerStatus.ACTIVE,
                    actions: [],
                    fields: []
                },
                message: ""
            }
        }else if (response.status == 400){
            // create a new checkbook user
            return await createCheckbbokUser(userId)
        }else{
            throw new UpdateCheckbookUserError(UpdateCheckbookUserErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
        }
        
    }catch(error){
        //  log
		createLog("user/util/updateCheckbookUser", userId, error.message, error.rawResponse)
		// process error
		if (error.type == updateBridgeCustomerErrorType.INTERNAL_ERROR) {
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

