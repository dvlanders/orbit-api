const supabase = require("../../supabaseClient");
const { v4 } = require("uuid");
const fileToBase64 = require("../../fileToBase64");
const { bridgeFieldsToDatabaseFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const {supabaseCall} = require("../../supabaseWithRetry")
const {BridgeCustomerStatus} = require("../utils")
const {createIndividualBridgeCustomer} = require("./submitIndividualBridgeCustomerApplication")


const UpdateBridgeCustomerErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INVALID_FIELD: "INVALID_FIELD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class UpdateBridgeCustomerError extends Error {
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
        let { data: bridgeCustomer, error:bridgeCustomerError } = await supabaseCall(() => supabase
        .from('bridge_customers')
        .select('*')
        .eq("user_id", userId)
        .maybeSingle()
    )

        if (bridgeCustomerError) throw new UpdateBridgeCustomerError(UpdateBridgeCustomerErrorType.INTERNAL_ERROR, bridgeCustomerError.message, bridgeCustomerError)
        if (!bridgeCustomer) throw new UpdateBridgeCustomerError(UpdateBridgeCustomerErrorType.INTERNAL_ERROR, "No user record found")
        if (!bridgeCustomer.status || !bridgeCustomer.bridge_id) {
            // resubmit application
            return await createIndividualBridgeCustomer(userId)
        }
        
        // update application
        return await createIndividualBridgeCustomer(userId, bridgeCustomer.bridge_id, true)



    }catch(error){
        //  log
		createLog("user/util/updateIndividualBridgeCustomer", userId, error.message, error.rawResponse)
		// process error
		if (error.type == UpdateBridgeCustomerErrorType.INTERNAL_ERROR) {
			return {
				status: 500,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: "Please contact HIFI for more information"
			}
		} else if (error.type == UpdateBridgeCustomerErrorType.RECORD_NOT_FOUND) {
			return {
				status: 500,
				customerStatus: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				usRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				euRamp: {
					status: CustomerStatus.INACTIVE,
					actions: [],
					fields: []
				},
				message: "Please contact HIFI for more information"
			}
		}

        return {
			status: 500,
			customerStatus: {
				status: CustomerStatus.INACTIVE,
				actions: [],
				fields: []
			},
			usRamp: {
				status: CustomerStatus.INACTIVE,
				actions: [],
				fields: []
			},
			euRamp: {
				status: CustomerStatus.INACTIVE,
				actions: [],
				fields: []
			},
			message: "Please contact HIFI for more information"
		}
    }
}