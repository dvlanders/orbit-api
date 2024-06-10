const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry")
const {createCheckbbokUser} = require("./createCheckbookUser")

const updateCheckbookUserErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class updateCheckbookUserError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, updateCheckbookUserError.prototype);
	}
}

exports.updateIndividualBridgeCustomer = async(userId) => {
    try {
        // check user bridge kyc status 
        let { data: checkbook_users, error: checkbook_users_error } = await supabaseCall(() => supabase
        .from('checkbook_users')
        .select('*')
        .eq("user_id", userId)
        .maybeSingle()
    )

        if (checkbook_users_error) throw new updateCheckbookUserError(updateCheckbookUserErrorType.INTERNAL_ERROR, bridge_customers_error.message, bridge_customers_error)
        if (checkbook_users) {
            return {
                status: 200,
                message: "Checkbook user already created",
                customerStatus: "active"

            }
        }

        // resubmit
        return await createCheckbbokUser(userId)

    }catch(error){
        //  log
		createLog("user/update", userId, error.message, error.rawResponse)
		console.error(`Error happens in update individual bridge user `, error)
		// process error
		if (error.type == updateBridgeCustomerErrorType.INTERNAL_ERROR) {
			return {
				status: 500,
				invalidFields: [],
				message: error.message,
                customerStatus: "failed"
			}
		}
        return {
            status: 500,
            invalidFields: [],
            message: "Internal server error",
            customerStatus: "failed"
        }
    }
}