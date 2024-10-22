const { v4 } = require("uuid");
const { currencyContractAddress } = require("../../common/blockchain");
const supabase = require("../../supabaseClient");
const { supabaseCall } = require("../../supabaseWithRetry");
const { getBastionWallet } = require("../../bastion/utils/getBastionWallet");
const { insertContractActionRecord } = require("../insertContractActionRecord");
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { erc20Approve } = require("../../bastion/utils/erc20FunctionMap");
const { updateContractActionRecord } = require("../updateContractActionRecord");
const { getUserWallet } = require("../../user/getUserWallet");
const { erc20ApproveWithFunctionName } = require("../utils/erc20");
const { submitTransactionCircle } = require("../../circle/main/submitTransaction");
const { safeParseBody } = require("../../utils/response");
const { insertSingleCircleTransactionRecord, updateCircleTransactionRecord } = require("../../circle/main/circleTransactionTableService");


const paymentProcessorContractMap = {
    production:{
        POLYGON_MAINNET: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_ADDRESS
    },
    development: {
        POLYGON_AMOY: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_ADDRESS
    }
}

const paymentProcessorContractOwnerMap = {
    production:{
        POLYGON_MAINNET: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_OWNER_BASTION_USER_ID
    },
    development: {
        POLYGON_AMOY: process.env.POLYGON_PAYMENT_PROCESSOR_CONTRACT_OWNER_BASTION_USER_ID
    }
}

const MAX_APPROVE_TOKEN = "10000000000000"

const _bastionApprove = async(userId, chain, currency, walletAddress, bastionUserId, paymentProcessorContract) => {
    // get currency adderss
    const currencyContract = currencyContractAddress[chain][currency]
    const requestId = v4()

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
        await createLog("smartContract/_bastionApprove", userId, responseBody.message, responseBody)
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

        await updateContractActionRecord(record.id, toUpdate)
    }else{
        // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
            bastion_status: responseBody.status,
            transaction_hash: responseBody.transactionHash,
            updated_at: new Date().toISOString()
        }
        
        await updateContractActionRecord(record.id, toUpdate)
    }
}

const _circleApprove = async(userId, chain, currency, walletAddress, circleWalletId, paymentProcessorContract) => {
    // get currency adderss
    const currencyContract = currencyContractAddress[chain][currency]
    const requestId = v4()
    const approveFunction = erc20ApproveWithFunctionName(currency, paymentProcessorContract, MAX_APPROVE_TOKEN)

    // insert initial circle transaction record
    const circleTransaction = {
        user_id: userId,
        request_id: requestId,
        circle_wallet_id: circleWalletId,
    }

    const circleTransactionData = await insertSingleCircleTransactionRecord(circleTransaction)
    const circleTransactionRecordId = circleTransactionData.id

    // insert initial record
    const requestInfo = {
        user_id: userId,
        chain,
        contract_address: currencyContract,
        wallet_address: walletAddress,
        wallet_provider: "CIRCLE",
        action_input: approveFunction,
        tag: "APPROVE_MAX_TO_PAYMENT_PROCESSOR",
        circle_transaction_record_id: circleTransactionRecordId,
        status: "CREATED"
    }

    const {data: record, error: recordError} = await supabase
        .from('contract_actions')
        .insert(requestInfo)
        .select()
        .single()

    if (recordError) throw new Error(recordError.message)

    const response = await submitTransactionCircle(record.id, requestId, circleWalletId, currencyContract, approveFunction.functionName, approveFunction.params)
    const responseBody = await safeParseBody(response)

    // map response
    if (!response.ok) {
        await createLog("smartContract/_circleApprove", userId, responseBody.message, responseBody)
         // update to contract action record
         const toUpdate = {
            status: "FAILED",
            updated_at: new Date().toISOString(),
            failed_reason: responseBody.message
        }

        // update to circle transaction record
        const toUpdateCircleTransaction = {
            circle_status: "FAILED",
            circle_response: responseBody,
            updated_at: new Date().toISOString(),
        }

        // update to contract action record and circle transaction record
        await Promise.all([ 
            updateContractActionRecord(record.id, toUpdate),
            updateCircleTransactionRecord(circleTransactionRecordId, toUpdateCircleTransaction)
        ])
    }else{
        // update to contract action record and circle transaction record
        const toUpdate = {
            status: "SUBMITTED",
            updated_at: new Date().toISOString()
        }

        // update to circle transaction record
        const toUpdateCircleTransaction = {
            circle_transaction_id: responseBody.data.id,
            circle_status: responseBody.data.state,
            circle_response: responseBody,
            updated_at: new Date().toISOString()
        }

        await Promise.all([
            updateContractActionRecord(record.id, toUpdate),
            updateCircleTransactionRecord(circleTransactionRecordId, toUpdateCircleTransaction)
        ])
    }
}

const approveMaxTokenToPaymentProcessor = async(userId, chain, currency, walletType) => {
    const env = process.env.NODE_ENV
    // get paymentProcessor address
    const paymentProcessorContract = paymentProcessorContractMap[env][chain]
    if (!paymentProcessorContract) throw new Error(`Payment Processor Contract is not deployed on ${chain}`)
    
    // get userWallet address
    const {address: walletAddress, bastionUserId, walletProvider, circleWalletId} = await getUserWallet(userId, chain, walletType)


    if (walletProvider === "BASTION"){
        await _bastionApprove(userId, chain, currency, walletAddress, bastionUserId, paymentProcessorContract)
    }else if (walletProvider === "CIRCLE"){
        await _circleApprove(userId, chain, currency, walletAddress, circleWalletId, paymentProcessorContract)
    }else{
        throw new Error("Unknown wallet provider")
    }

}

module.exports = {
    MAX_APPROVE_TOKEN,
    approveMaxTokenToPaymentProcessor,
    paymentProcessorContractMap,
    paymentProcessorContractOwnerMap
}