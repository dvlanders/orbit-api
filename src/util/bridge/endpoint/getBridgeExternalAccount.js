const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry")
const { v4 } = require("uuid");
const { BridgeCustomerStatus, RejectionReasons, AccountActions, getEndorsementStatus, extractActionsAndFields } = require("../utils");
const createLog = require("../../logger/supabaseLogger");
const { CustomerStatus } = require("../../user/common");
const { fetchWithLogging } = require("../../logger/fetchLogger");
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;


const getBridgeExternalAccountErrorType = {
	CUSTOMER_RECORD_NOT_FOUND: "CUSTOMER_RECORD_NOT_FOUND",
	EXTERNAL_ACCOUNT_RECORD_NOT_FOUND: "EXTERNAL_ACCOUNT_RECORD_NOT_FOUND",
	INTERNAL_ERROR: "INTERNAL_ERROR",
};

class getBridgeExternalAccountError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, getBridgeExternalAccountError.prototype);
	}
}


// const BridgeEndorsementStatus = {
// 	APPROVED: "approved",
// 	INCOMPLETE: "incomplete",
// 	REVOKED: "revoked"
// }
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
exports.getBridgeExternalAccount = async (userId, accountId) => {


	try {

		// check if the bridge external account exists
		const { data: bridgeCustomerData, error: bridgeCustomerError } = await supabaseCall(() => supabase
			.from('bridge_customers')
			.select('*')
			.eq('user_id', userId)
			.maybeSingle()
		)
		if (bridgeCustomerError) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.INTERNAL_ERROR, bridgeCustomerError.message, bridgeCustomerError)
		if (!bridgeCustomerData) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.RECORD_NOT_FOUND, "User not found")


		// check if the bridge external account exists
		const { data: bridgeExternalAccountData, error: bridgeExternalAccountError } = await supabaseCall(() => supabase
			.from('bridge_external_accounts')
			.select('*')
			.eq('id', accountId)
			.maybeSingle()
		)
		if (bridgeExternalAccountError) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.INTERNAL_ERROR, bridgeExternalAccountError.message, bridgeExternalAccountError)
		if (!bridgeExternalAccountData) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.EXTERNAL_ACCOUNT_RECORD_NOT_FOUND, "Account not found")


		// fetch up-to-date infortmation
		const response = await fetchWithLogging(`${BRIDGE_URL}/v0/customers/${bridgeCustomerData.bridge_id}/external_accounts/${bridgeExternalAccountData.bridge_external_account_id}`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});

		const bridgeData = await response.json()

		if (response.status == 500) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.INTERNAL_ERROR, "Bridge internal server error", bridgeData)
		if (!response.ok) throw new getBridgeExternalAccountError(getBridgeExternalAccountErrorType.INTERNAL_ERROR, bridgeData.message, bridgeData)

		return {
			bridgeExternalAccountData: bridgeExternalAccountData,
			bridgeData: bridgeData,
		}


	} catch (error) {

		await createLog("user/util/getBridgeExternalAccount", userId, error.message, error)
		return {
			error: error
		}
	}

}


