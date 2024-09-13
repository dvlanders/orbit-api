const createLog = require("../../src/util/logger/supabaseLogger")
const supabase = require("../../src/util/supabaseClient")

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;


const _deleteTransfer = async(record) => {
    // delete transfer from bridge API
    const response = await fetch(`${BRIDGE_URL}/v0/transfers/${record.bridge_transfer_id}`, {
        method: 'DELETE',
        headers: {
            'Api-Key': BRIDGE_API_KEY
        }
    });
    const responseBody = await response.json()
    if (!response.ok){
        await createLog("pollDeleteBridgeOfframpTransfer/_deleteTransfer", record.user_id, responseBody.message, responseBody)
    }

    // get up-to-date record
    const updatedResponse = await fetch(`${BRIDGE_URL}/v0/transfers/${record.bridge_transfer_id}`, {
        method: 'GET',
        headers: {
            'Api-Key': BRIDGE_API_KEY
        }
    });
    const updatedResponseBody = await updatedResponse.json()
    if (!updatedResponse.ok){
        await createLog("pollDeleteBridgeOfframpTransfer/_deleteTransfer", record.user_id, updatedResponseBody.message, updatedResponseBody)
        throw new Error(`Failed to get bridge transfer for transfer id: ${record.id}`)
    }

    // update to database
    const {data, error} = await supabase
        .from("offramp_transactions")
        .update({
            updated_at: new Date().toISOString(),
            bridge_response: updatedResponseBody,
            bridge_transaction_status: updatedResponseBody.state,
        })
        .eq("id", record.id)
    
    if (error) {
        await createLog("pollDeleteBridgeOfframpTransfer/_deleteTransfer", record.user_id, error.message, error)
        throw new Error(`Failed to update bridge transfer to table for transfer id: ${record.id}`)
    }
    return
}

const pollDeleteBridgeOfframpTransfer = async() => {
    try{

        const {data, error} = await supabase
            .from("offramp_transactions")
            .select("id, transaction_status, bridge_transaction_status, fiat_provider, bridge_transfer_id, bastion_transaction_status, bridge_transfer_id, user_id")
            .eq("fiat_provider", "BRIDGE")
            .not("bridge_transfer_id", "is", null)
            .or("transaction_status.eq.NOT_INITIATED,transaction_status.eq.FAILED_ONCHAIN")
            .eq("bridge_transaction_status", "awaiting_funds")
            .order("created_at", {ascending: false})

        await Promise.all(data.map(async(record) => {
            try{
                await _deleteTransfer(record)
                return
            }catch (error){
                await createLog("pollDeleteBridgeOfframpTransfer/_deleteTransfer", record.user_id, error.message, error)
                return
            }
        }))

    }catch (error){
        await createLog("pollDeleteBridgeOfframpTransfer", null, error.message, error)
        return 
    }
}

module.exports = pollDeleteBridgeOfframpTransfer