const supabase = require("../../supabaseClient");
const supabaseCall = require("../../supabaseWithRetry")
const { v4 } = require("uuid");
const { BridgeCustomerStatus, virtualAccountPaymentRailToChain, getEndorsementStatus } = require("../utils");
const createLog = require("../../logger/supabaseLogger");

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

const CustomerStatus = {
    INACTIVE: "INACTIVE",
    ACTIVE: "ACTIVE",
    PENDING: "PENDING",
}
const BridgeEndorsementStatus = {
    APPROVED: "approved",
    INCOMPLETE: "incomplete",
    REVOKED: "revoked"
}
/**
 * return 
    status: 200, 400, 500

    customerStatus: PENDING, INACTIVE, ACTIVE

    usOffRamp: PENDING, INACTIVE, ACTIVE

    euOffRamp: PENDING, INACTIVE, ACTIVE

    user try to call when bridge customer is not created status: 400
    other should be internal server error

 * @param {*} userId 
 * @returns 
 */
exports.getBridgeCustomer = async(userId) => {

    try{
        const { data: bridge_customer, error: bridge_customer_error } = await supabaseCall(() => supabase
            .from('bridge_customers')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
        )
        if (bridge_customer_error) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customer_error.message, bridge_customer_error)
        if (!bridge_customer) throw new getBridgeCustomerError(getBridgeCustomerErrorType.RECORD_NOT_FOUND, "User not found")
        if (!bridge_customer.status || !bridge_customer.bridge_id) {
            return {
                status: 400,
                customerStatus: CustomerStatus.FAILED,
                usOffRamp: CustomerStatus.FAILED,
                euOffRamp: CustomerStatus.FAILED,
                message: "kyc aplication not submitted, please use user/update to resubmit application"
            }
        }

        // fetch up-to-date infortmation
        const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeId}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});
        const responseBody = await response.json()
        if (response.status == 500) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, "Bridge internal server error", responseBody)
        if (!response.ok) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, responseBody.message, responseBody)

        const base_status = getEndorsementStatus(responseBody.endorsements, "base")
        const sepa_status = getEndorsementStatus(responseBody.endorsements, "sepa")
        // update to database
        const { data: updated_bridge_customer, error: updated_bridge_customer_error } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.update({
                bridge_response: responseBody,
                status: responseBody.status,
                base_status,
                sepa_status,
            })
			.eq('user_id', userId)
			.maybeSingle()
        )


        if (updated_bridge_customer_error) throw new getBridgeCustomerError(getBridgeCustomerErrorType.INTERNAL_ERROR, bridge_customer_error.message, bridge_customer_error)
        if (!updated_bridge_customer) throw new getBridgeCustomerError(getBridgeCustomerErrorType.RECORD_NOT_FOUND, "User not found")


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
                customerStatus: CustomerStatus.PENDING,
                usOffRamp: CustomerStatus.PENDING,
                euOffRamp: CustomerStatus.PENDING,
                message: "please reach out to HIFI for more details"
            }
        }
        
        if (customerStatus == CustomerStatus.INACTIVE){
            return {
                status: 400,
                customerStatus: CustomerStatus.INACTIVE,
                usOffRamp: CustomerStatus.INACTIVE,
                euOffRamp: CustomerStatus.INACTIVE,
                message: "kyc aplication not submitted, please use user/update to resubmit application"
            }
        }else if (customerStatus == CustomerStatus.PENDING){
            return {
                status: 200,
                customerStatus: CustomerStatus.PENDING,
                usOffRamp: CustomerStatus.PENDING,
                euOffRamp: CustomerStatus.PENDING,
                message: "kyc aplication still under review"
            }
        }else if (customerStatus == CustomerStatus.ACTIVE){
            return {
                status: 200,
                customerStatus: CustomerStatus.ACTIVE,
                usOffRamp: base_status == BridgeEndorsementStatus.APPROVED? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
                euOffRamp: sepa_status == BridgeEndorsementStatus.APPROVED? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE,
                message: ""
            }
        }
        
        
    }catch (error){

        createLog("user/util/getBridgeCustomer", userId, error.message, error.rawResponse)
        if (error.type == getBridgeCustomerErrorType.INTERNAL_ERROR){
            return {
                status: 500,
                customerStatus: CustomerStatus.INACTIVE,
                usOffRamp: CustomerStatus.INACTIVE,
                euOffRamp: CustomerStatus.INACTIVE,
                message: error.message
            }
        }else if (error.type == getBridgeCustomerErrorType.RECORD_NOT_FOUND){
            return {
                status: 404,
                customerStatus: CustomerStatus.INACTIVE,
                usOffRamp: CustomerStatus.INACTIVE,
                euOffRamp: CustomerStatus.INACTIVE,
                message: error.message
            }
        }
        return {
            status: 500,
            customerStatus: CustomerStatus.INACTIVE,
            usOffRamp: CustomerStatus.INACTIVE,
            euOffRamp: CustomerStatus.INACTIVE,
            message: error.message
        }
    }

}
