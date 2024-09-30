const { submitUserAction } = require("../../bastion/endpoints/submitUserAction")
const { erc20Approve } = require("../../bastion/utils/erc20FunctionMap")
const { currencyContractAddress } = require("../../common/blockchain")
const { tokenMessenger } = require("./utils")
const { safeParseBody } = require("../../utils/response");
const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const { v4 } = require("uuid");
const { getMappedError } = require("../../bastion/utils/errorMappings");


const approveToTokenMessenger = async (amount, chain, userId, bastionUserId, walletAddress) => {
    // get token messenger info for the given chain
    const tokenMessengerInfo = tokenMessenger[chain]
    if (!tokenMessengerInfo) {
        throw new Error("Token messenger contract not found for chain: " + chain)
    }

    // get usdc contract address
    const usdcContractAddress = currencyContractAddress[chain]["usdc"]
    if (!usdcContractAddress) {
        throw new Error("USDC contract address not found for chain: " + chain)
    }

    // config user action
    const contractInput = erc20Approve("usdc", tokenMessengerInfo.address, amount)

    // insert contract action record
    const requestId = v4()  
    const {data: record, error: insertError} = await supabase
        .from('contract_actions')
        .insert({
            contract_address: usdcContractAddress,
            wallet_address: walletAddress,
            user_id: userId,
            bastion_user_id: bastionUserId,
            wallet_provider: "BASTION",
            action_input: contractInput,
            bastion_request_id: requestId,
            tag: "APPROVE_TO_TOKEN_MESSENGER",
            status: "CREATED",
            chain: chain
        })
        .select("*")
        .single()

    if (insertError) throw new Error("Error inserting contract action record: " + insertError.message)

    // submit user action to bastion
    const bodyObject = {
		requestId: requestId,
		userId: bastionUserId,
		contractAddress: usdcContractAddress,
		actionName: "approve",
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
        const errorMessageForCustomer = getMappedError(responseBody.message)
        

        return {success: false, record: updatedRecord, errorMessageForCustomer}
    }

    // update contract action record
    const {data: updatedRecord, error: updateError} = await supabase
        .from('contract_actions')
        .update({
            status: responseBody.status,
            bastion_status: responseBody.status,
            bastion_response: responseBody,
            updated_at: new Date().toISOString(),
            transaction_hash: responseBody.transactionHash
        })
        .eq('id', record.id)
        .select()
        .single()

    if (updateError) throw new Error("Error updating contract action record: " + updateError.message)
    return {success: true, record: updatedRecord}
}

module.exports = { approveToTokenMessenger }
