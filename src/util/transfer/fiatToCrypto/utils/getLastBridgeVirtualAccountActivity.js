const createLog = require("../../../logger/supabaseLogger");
const supabase = require("../../../supabaseClient");
const { supabaseCall } = require("../../../supabaseWithRetry");
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

exports.getLastBridgeVirtualAccountActivity = async (userId, bridgeVirtualAccountId) => {
    try{
        // get bridge user Id
        const {data: bridgeUser, error: bridgeUserError} = await supabaseCall(() => supabase
        .from("bridge_customers")
        .select("bridge_id")
        .eq("user_id", userId)
        .single())

        if (bridgeUserError) throw bridgeUserError

        // get latest activity id of the virtual account
        const response = await fetch(`${BRIDGE_URL}/v0/customers/${bridgeUser.bridge_id}/virtual_accounts/${bridgeVirtualAccountId}/history?limit=1`, {
			method: 'GET',
			headers: {
				'Api-Key': BRIDGE_API_KEY
			}
		});
        const responseBody = await response.json()

        if (!response.ok){
            await createLog("transfer/fiatToCrypto/utils/getLastBridgeVirtualAccountActivity", userId, responseBody.error, responseBody)
            return null
        }

        if (responseBody.count > 0){
            return responseBody.data[0].id
        }

        return null


    }catch (error){
        await createLog("transfer/fiatToCrypto/utils/getLastBridgeVirtualAccountActivity", userId, error.message, error)
        return null
    }
}