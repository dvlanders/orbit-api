const createLog = require("../../logger/supabaseLogger");
const { getBridgeUserId } = require("../utils");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const fetchBridgeVirtualAccountMicroDeposit = async(userId, virtualAccountId, limit=10, createdBefore , createdAfter) => {
    try{

        // const bridgeId = await getBridgeUserId(userId)
        const bridgeId = "a8245c09-12af-4f91-8ec5-e95e5be81717"
        const virtualAccountId = "45105ad0-73ab-4164-988a-69c070af4832"
        const url = `${BRIDGE_URL}/v0/customers/${bridgeId}/virtual_accounts/${virtualAccountId}/history?event_type=microdeposit&limit=${limit}${createdBefore? `&starting_after=${createdBefore}`: ""}${createdAfter? `&ending_before=${createdAfter}`: ""}`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Api-Key': BRIDGE_API_KEY
            }
        })

        const responseBody = await response.json()

        if (!response.ok) {
            console.error(responseBody)
            // createLog("bridge/fetchBridgeVirtualAccountMicroDeposit", userId, "Fail to fetch Bridge Virtual Account Micro Deposit", responseBody)
            return {count: 0, data: [], message: "something went wrong, please contact HIFI for more information"}
        }

        const microDeposits = responseBody.data.map((microDeposit) => {
            return{
                eventId: microDeposit.id,
                currency: microDeposit.currency,
                createdAt: microDeposit.created_at,
                amount: microDeposit.amount,
                sourceBankAccountDetails: {
                    description: microDeposit.source.description,
                    bankName:  microDeposit.source.sender_name,
                    routingNumber: microDeposit.source.sender_bank_routing_number,
                    traceNumber: microDeposit.source.trace_number
                }
            }
        })

        return {count: responseBody.count, data: microDeposits}



    }catch (error){
        console.error(error)
        // createLog("bridge/fetchBridgeVirtualAccountMicroDeposit", userId, error.message)
        return {count: 0, data: [], message: "something went wrong, please contact HIFI for more information"}
    }

}

module.exports = fetchBridgeVirtualAccountMicroDeposit