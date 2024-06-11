const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const fileToBase64 = require("../../fileToBase64");
const { bridgeFieldsToDatabaseFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry")
const {BridgeCustomerStatus} = require("../utils")
const {createIndividualBridgeCustomer} = require("./createIndividualBridgeCustomer")


const updateBridgeCustomerErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class updateBridgeCustomerError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, updateBridgeCustomerError.prototype);
	}
}

exports.updateIndividualBridgeCustomer = async(userId) => {
    try {
        // check user bridge kyc status 
        let { data: bridge_customers, error:bridge_customers_error } = await supabaseCall(() => supabase
        .from('bridge_customers')
        .select('status')
        .eq("user_id", userId)
        .maybeSingle()
    )

        if (bridge_customers_error) throw new updateBridgeCustomerError(updateBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customers_error.message, bridge_customers_error)
        if (!bridge_customers) throw new updateBridgeCustomerError(updateBridgeCustomerErrorType.RECORD_NOT_FOUND, "No user record found")

        // user already passed kyc
        if (bridge_customers.status == BridgeCustomerStatus.ACTIVE) {
            return {
                status: 200,
                message: "Customer kyc already passed",
                customerStatus: BridgeCustomerStatus.status

            }
        }
        // resubmit
        return await createIndividualBridgeCustomer(userId)

    }catch(error){
        //  log
		createLog("user/update", userId, error.message, error.rawResponse)
		console.error(`Error happens in update individual bridge user `, error)
		// process error
		if (error.type == updateBridgeCustomerErrorType.INTERNAL_ERROR) {
			return {
				status: 500,
				invalidFields: [],
				message: error.message
			}
		} else if (error.type == updateBridgeCustomerErrorType.RECORD_NOT_FOUND) {
			return {
				status: 404,
				invalidFields: [],
				message: error.message
			}
		}

        return {
            status: 500,
            invalidFields: [],
            message: "Internal server error"
        }
    }
}