const { v4 } = require("uuid")
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction")
const { currencyContractAddress } = require("../../common/blockchain")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { safeParseBody } = require("../../utils/response")
const { initContractInstance } = require("../common/contract")
const { tokenMessenger, addressToBytes32 } = require("./utils")
const { getMappedError } = require("../../bastion/utils/errorMappings")

const burnUsdc = async(amount, sourceChain, destinationChain, userId, bastionUserId, sourceWalletAddress, destinationWalletAddress) => {
    // get token messenger info for the given chain
    const tokenMessengerInfo = tokenMessenger[sourceChain]
    if (!tokenMessengerInfo) {
        throw new Error("Token messenger contract not found for chain: " + sourceChain)
    }       
    // get usdc contract address
    const usdcContractAddress = currencyContractAddress[sourceChain]["usdc"]
    if (!usdcContractAddress) {
        throw new Error("USDC contract address not found for chain: " + sourceChain)
    }
    // get destination token messenger info
    const destinationTokenMessengerInfo = tokenMessenger[destinationChain]
    if (!destinationTokenMessengerInfo) {
        throw new Error("Token messenger contract not found for chain: " + destinationChain)
    }

    // init token messenger contract and call addressToBytes32
    const recipientBytes32Address = addressToBytes32(destinationWalletAddress)

    const contractInput = [
        {
            name: "amount",
            value: amount
        },
        {
            name: "destinationDomain",
            value: destinationTokenMessengerInfo.domain
        },
        {
            name: "mintRecipient",
            value: recipientBytes32Address
        },
        {
            name: "burnToken",
            value: usdcContractAddress
        }
    ]
   
     // insert contract action record
     const requestId = v4()  
     const {data: record, error: insertError} = await supabase
         .from('contract_actions')
         .insert({
             contract_address: tokenMessengerInfo.address,
             wallet_address: sourceWalletAddress,
             user_id: userId,
             bastion_user_id: bastionUserId,
             wallet_provider: "BASTION",
             action_input: contractInput,
             bastion_request_id: requestId,
             tag: "BURN_USDC_ON_SOURCE_CHAIN",
             status: "CREATED",
             chain: sourceChain
         })
         .select()
         .single()
 
     if (insertError) throw new Error("Error inserting contract action record: " + insertError.message)
 
     // submit user action to bastion
     const bodyObject = {
         requestId: requestId,
         userId: bastionUserId,
         contractAddress: tokenMessengerInfo.address,
         actionName: "depositForBurn",
         chain: sourceChain,
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

module.exports = { burnUsdc }