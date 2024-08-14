const { v4 } = require("uuid");
const { currencyContractAddress } = require("../../common/blockchain");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
const { insertContractActionRecord } = require("../insertContractActionRecord");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { erc20Approve } = require("../../bastion/utils/erc20FunctionMap");
const { updateContractActionRecord } = require("../updateContractActionRecord");


const paymentProcessorContractMap = {
    production:{
        POLYGON_MAINNET: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_ADDRESS
    }
}

const paymentProcessorContractOwnerMap = {
    production:{
        POLYGON_MAINNET: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_OWNER_BASTION_USER_ID
    }
}

const MAX_APPROVE_TOKEN = "10000000000000"

const approveMaxTokenToPaymentProcessor = async(userId, chain, currency) => {
    const env = process.env.NODE_ENV
    // get paymentProcessor address
    const paymentProcessorContract = paymentProcessorContractMap[env][chain]
    if (!paymentProcessorContract) throw new Error(`Payment Processor Contract is not deployed on ${chain}`)
    
    // get currency adderss
    const currencyContract = currencyContractAddress[chain][currency]
    const requestId = v4()
    // get userWallet address
    const {walletAddress, bastionUserId} = await getBastionWallet(userId, chain)


    // insert initial record
    const requestInfo = {
        bastionRequestId: requestId,
        userId,
        chain,
        contractAddress: currencyContract,
        walletAddress,
        provider: "BASTION",
        actionInput: erc20Approve(currency, paymentProcessorContract, MAX_APPROVE_TOKEN),
        tag: "APPROVE_MAX_TO_PAYMENT_PROCESSOR",
        bastionUserId: bastionUserId
    }

    const record = await insertContractActionRecord(requestInfo)

    //  function call to Bastion
    const bodyObject = {
		requestId: requestId,
		userId: bastionUserId,
		contractAddress: currencyContract,
		actionName: "approve",
		chain: chain,
		actionParams: erc20Approve(currency, paymentProcessorContract, MAX_APPROVE_TOKEN)
	};

    const response = await submitUserAction(bodyObject)
    const responseBody = await response.json()
    // map response
    if (!response.ok) {
        await createLog("smartContract/approve", userId, responseBody.message, responseBody)
         // update to database
         const toUpdate = {
            response: responseBody,
            status: "FAILED",
            bastion_status: 'FAILED',
            updated_at: new Date().toISOString()
        }
        if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
            toUpdate.failedReason = "Transfer amount exceeds balance"
        }else{
            toUpdate.failedReason = "Not enough gas, please contact HIFI for more information"
        }

        const updatedRecord = await updateContractActionRecord(record.id, toUpdate)
    }else{

        // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
            bastion_status: responseBody.status,
            transaction_hash: responseBody.transactionHash,
            updated_at: new Date().toISOString()
        }
        
        const updatedRecord = await updateContractActionRecord(record.id, toUpdate)
    }

}

module.exports = {
    MAX_APPROVE_TOKEN,
    approveMaxTokenToPaymentProcessor,
    paymentProcessorContractMap,
    paymentProcessorContractOwnerMap
}