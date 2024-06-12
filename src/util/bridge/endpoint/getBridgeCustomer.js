const supabase = require("../../supabaseClient");
const {supabaseCall} = require("../../supabaseWithRetry")
const { v4 } = require("uuid");
const { BridgeCustomerStatus, RejectionReasons, AccountActions, getEndorsementStatus, extractActionsAndFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const { CustomerStatus } = require("../../user/common");
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;


const getBridgeCustomerErrorType = {
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class getBridgeCustomerError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, getBridgeCustomerError.prototype);
	}
}


const BridgeEndorsementStatus = {
    APPROVED: "approved",
    INCOMPLETE: "incomplete",
    REVOKED: "revoked"
}
/**
 * return 
 * status: 200, 400, 500, 404
 * customerStatus: object  
 * usOffRamp: object  
 * euOffRamp: object  
 * status: 200 for created bridge customer (pending or success)  
 * status: 400 for rejected for not submitted customer  
 * status: 404 for possibly unsubmit application    
 * status: 500 for internal server error      

 * @param {*} userId 
 * @returns 
 */
const getBridgeCustomer = async(userId) => {

    try{
        // check if the application is submitted
        const { data: bridgeCustomer, error: bridgeCustomerError } = await supabaseCall(() => supabase
            .from('bridge_customers')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
        )
        if (bridgeCustomerError) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, bridgeCustomerError.message, bridgeCustomerError)
        if (!bridgeCustomer) throw new getBridgeCustomerError(getBridgeCustomerErrorType.RECORD_NOT_FOUND, "User not found")
        if (!bridgeCustomer.status || !bridgeCustomer.bridge_id) {
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.FAILED,
                    actions: ["update"],
                    fields: []
                },
                usRamp: {
                    status: CustomerStatus.FAILED,
                    actions: [],
                    fields: []
                },
                euRamp: {
                    status: CustomerStatus.FAILED,
                    actions: [],
                    fields: []
                },
                message: "kyc aplication not submitted, please use user/update to resubmit application"
            }
        }

        // fetch up-to-date infortmation
        const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeCustomer.bridge_id}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});
        const responseBody = await response.json()
        if (response.status == 500) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, "Bridge internal server error", responseBody)
        if (!response.ok) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, responseBody.message, responseBody)
        // extract rejections
        
        const reasons = responseBody.rejection_reasons.map((reason) => {
            return reason.developer_reason
        })
        const {requiredActions, fieldsToResubmit} = extractActionsAndFields(reasons)
        
        //extract base, sepa status
        const {status: baseStatus, actions:baseActions, fields:baseFields} = getEndorsementStatus(responseBody.endorsements, "base")
        const {status: sepaStatus, actions:sepaActions, fields:sepaFields} = getEndorsementStatus(responseBody.endorsements, "sepa")
        // update to database
        const { error: updatedBridgeCustomerError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.update({
                bridge_response: responseBody,
                status: responseBody.status,
                base_status: baseStatus,
                sepa_status: sepaStatus,
            })
			.eq('user_id', userId)
			.maybeSingle()
        )


        if (updatedBridgeCustomerError) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, updatedBridgeCustomerError.message, updatedBridgeCustomerError)

        let customerStatus = CustomerStatus.PENDING

        // map status
        if (responseBody.status == BridgeCustomerStatus.INCOMPLETE || responseBody.status == BridgeCustomerStatus.REJECTED || responseBody.status == BridgeCustomerStatus.UNKNOWN || responseBody.status == BridgeCustomerStatus.AWAITING_UBO){
            customerStatus = CustomerStatus.INACTIVE
        }else if (responseBody.status == BridgeCustomerStatus.ACTIVE){
            customerStatus = CustomerStatus.ACTIVE
        }else if (responseBody.status == BridgeCustomerStatus.NOT_STARTED || responseBody.status == BridgeCustomerStatus.MANUAL_REVIEW || responseBody.status == BridgeCustomerStatus.UNDER_REVIEW || responseBody.status == BridgeCustomerStatus.PENDING) {
            customerStatus = CustomerStatus.PENDING
        }else {
            // unable to map existing status 
            createLog("user/utils/getBridgeCustomer", userId, `Unmatched bridge customer status ${responseBody.status}`, null)
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.PENDING,
                    actions: requiredActions,
                    fields: fieldsToResubmit
                },
                usRamp: {
                    status: CustomerStatus.PENDING,
                    actions: baseActions,
                    fields: baseFields
                },
                euRamp: {
                    status: CustomerStatus.PENDING,
                    actions: sepaActions,
                    fields: sepaFields
                },
                message: "please reach out to HIFI for more details"
            }
        }
        
        if (customerStatus == CustomerStatus.INACTIVE){
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.INACTIVE,
                    actions: [...requiredActions, "update"],
                    fields: fieldsToResubmit
                },
                usRamp: {
                    status: CustomerStatus.INACTIVE,
                    actions: baseActions,
                    fields: baseFields
                },
                euRamp: {
                    status: CustomerStatus.INACTIVE,
                    actions: sepaActions,
                    fields: sepaFields
                },
                message: "please use user/update to resubmit application with required fields"
            }
        }else if (customerStatus == CustomerStatus.PENDING){
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.PENDING,
                    actions: requiredActions,
                    fields: fieldsToResubmit
                },
                usRamp: {
                    status: CustomerStatus.PENDING,
                    actions: baseActions,
                    fields: baseFields
                },
                euRamp: {
                    status: CustomerStatus.PENDING,
                    actions: sepaActions,
                    fields: sepaFields
                },
                message: "kyc aplication still under review"
            }
        }else if (customerStatus == CustomerStatus.ACTIVE){
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.ACTIVE,
                    actions: requiredActions,
                    fields: fieldsToResubmit
                },
                usRamp: {
                    status: baseStatus == BridgeEndorsementStatus.APPROVED? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
                    actions: baseActions,
                    fields: baseFields
                },
                euRamp: {
                    status: sepaStatus == BridgeEndorsementStatus.APPROVED? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
                    actions: sepaActions,
                    fields: sepaFields
                },
                message: ""
            }
        }else{
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.PENDING,
                    actions: [],
                    fields: []
                },
                usRamp: {
                    status: CustomerStatus.PENDING,
                    actions: [],
                    fields: []
                },
                euRamp: {
                    status: CustomerStatus.PENDING,
                    actions: [],
                    fields: []
                },
                message: "Please contact HIFI for more information"
            }
        }
        
        
    }catch (error){

        createLog("user/util/getBridgeCustomer", userId, error.message, error.rawResponse)
        if (error.type == getBridgeCustomerErrorType.INTERNAL_ERROR){
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
        }else if (error.type == getBridgeCustomerErrorType.RECORD_NOT_FOUND){
            return {
                status: 200,
                customerStatus: {
                    status: CustomerStatus.INACTIVE,
                    actions: ["update"],
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
                message: "Please call user/update to resubmit application"
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

module.exports = getBridgeCustomer
