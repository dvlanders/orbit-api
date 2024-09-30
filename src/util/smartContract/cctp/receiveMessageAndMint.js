const { v4 } = require("uuid")
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { safeParseBody } = require("../../utils/response")
const { messageTransmitter } = require("./utils")

const receiveMessageAndMint = async (userId, bastionUserId, chain, messageBytes, attestationSignature, walletAddress) => {
    // get message transmitter address
    const messageTransmitterInfo = messageTransmitter[chain]
    if (!messageTransmitterInfo) throw new Error("Message transmitter not found")

    const contractInput = [
        {
            name: "message",
            value: messageBytes
        },
        {
            name: "attestation",
            value: attestationSignature
        },
    ]
    
        // insert contract action record
        const requestId = v4()  
        const {data: record, error: insertError} = await supabase
            .from('contract_actions')
            .insert({
                contract_address: messageTransmitterInfo.address,
                wallet_address: walletAddress,
                user_id: userId,
                bastion_user_id: bastionUserId,
                wallet_provider: "BASTION",
                action_input: contractInput,
                bastion_request_id: requestId,
                tag: "RECEIVE_MESSAGE_AND_MINT",
                status: "CREATED",
                chain: chain
            })
            .select()
            .single()
    
        if (insertError) throw new Error("Error inserting contract action record: " + insertError.message)
    
        // submit user action to bastion
        const bodyObject = {
            requestId: requestId,
            userId: bastionUserId,
            contractAddress: messageTransmitterInfo.address,
            actionName: "receiveMessage",
            chain: chain,
            actionParams: contractInput
        }
    
        const response = await submitUserAction(bodyObject)
        const responseBody = await safeParseBody(response)
    
        // update contract action record
        if (!response.ok) {
            await createLog("smartContract/cctp/approve", userId, responseBody.message, responseBody)
            const {data: updatedRecord, error: updateError} = await supabase
            .from('contract_actions')
            .update({
                status: "FAILED",
                bastion_response: responseBody,
                updated_at: new Date().toISOString(),
                failed_reason: responseBody.message
            })
            .eq('id', record.id)
            .select()
            .single()

            if (updateError) throw new Error("Error updating contract action record: " + updateError.message)

            return {success: false, record: updatedRecord}
        }
    
        // update contract action record
        const {data: updatedRecord, error: updateError} = await supabase
            .from('contract_actions')
            .update({
                status: responseBody.status,
                bastion_status: responseBody.status,
                bastion_response: responseBody,
                updated_at: new Date().toISOString(),
            })
            .eq('id', record.id)
            .select()
            .single()

    if (updateError) throw new Error("Error updating contract action record: " + updateError.message)

    return {success: true, record: updatedRecord}

    
}

module.exports = { receiveMessageAndMint }