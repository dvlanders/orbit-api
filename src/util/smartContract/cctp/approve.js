const { submitUserAction } = require("../../bastion/endpoints/submitUserAction")
const { erc20Approve } = require("../../bastion/utils/erc20FunctionMap")
const { currencyContractAddress } = require("../../common/blockchain")
const { tokenMessenger } = require("./utils")
const { safeParseBody } = require("../../utils/response");
const supabase = require("../../supabaseClient");
const createLog = require("../../logger/supabaseLogger");
const { v4 } = require("uuid");
const { getMappedError } = require("../../bastion/utils/errorMappings");
const { getUserWallet } = require("../../user/getUserWallet");
const { insertWalletTransactionRecord, approveAction } = require("../../transfer/walletOperations/utils");
const { insertSingleContractActionRecord } = require("../../transfer/contractAction/contractActionTableService");
const { updateContractActionRecord } = require("../updateContractActionRecord");
const { erc20ApproveWithFunctionName } = require("../utils/erc20");
const { insertSingleCircleTransactionRecord } = require("../../circle/main/circleTransactionTableService");

const _bastionApprove = async(userId, chain, walletAddress, bastionUserId, amount, tokenMessengerInfo, usdcContractAddress) => {
    // get currency adderss
    const requestId = v4()

    // insert provider record
    const toInsertProviderRecord = {
        user_id: userId,
        request_id: requestId,
        bastion_user_id: bastionUserId,
    }
    const providerRecord = await insertWalletTransactionRecord("BASTION", toInsertProviderRecord)

    // insert initial record
    const toInsertContractActionRecord = {
        user_id: userId,
        chain,
        contract_address: usdcContractAddress,
        wallet_address: walletAddress,
        wallet_provider: "BASTION",
        action_input: erc20Approve("usdc", tokenMessengerInfo.address, amount),
        tag: "APPROVE_TO_TOKEN_MESSENGER",
        bastion_transaction_record_id: providerRecord.id,
        status: "CREATED"
    }

    const contractActionRecord = await insertSingleContractActionRecord(toInsertContractActionRecord)

    //  approve
    const approveConfig = {
		senderBastionUserId: bastionUserId,
        spender: tokenMessengerInfo.address, 
        unitsAmount: amount, 
        chain, 
        currency: "usdc", 
        providerRecordId: providerRecord.id, 
        transferType: "CONTRACT_ACTION"
	};

    const {response, responseBody, mainTableStatus, providerStatus} = await approveAction("BASTION", approveConfig)

    const toUpdateContractActionRecord = {
        status: mainTableStatus,
        updated_at: new Date().toISOString()
    }

    // map response
    if (!response.ok) {
        await createLog("smartContract/_bastionApprove", userId, responseBody.message, responseBody)
        if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
            toUpdateContractActionRecord.failed_reason = "Transfer amount exceeds balance"
        }else{
            toUpdateContractActionRecord.failed_reason = "Not enough gas, please contact HIFI for more information"
        }
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)
    return {success: response.ok, record: updatedContractActionRecord}
}

const _circleApprove = async(userId, chain, walletAddress, circleWalletId, amount, tokenMessengerInfo, usdcContractAddress) => {
    // get currency adderss
    const requestId = v4()
    const approveFunction = erc20ApproveWithFunctionName("usdc", tokenMessengerInfo.address, amount)

    // insert initial circle transaction record
    const circleTransaction = {
        user_id: userId,
        request_id: requestId,
        circle_wallet_id: circleWalletId,
    }

    const circleTransactionRecord = await insertSingleCircleTransactionRecord(circleTransaction)

    // insert initial record
    const requestInfo = {
        user_id: userId,
        chain,
        contract_address: usdcContractAddress,
        wallet_address: walletAddress,
        wallet_provider: "CIRCLE",
        action_input: approveFunction,
        tag: "APPROVE_TO_TOKEN_MESSENGER",
        circle_transaction_record_id: circleTransactionRecord.id,
        status: "CREATED"
    }
    const contractActionRecord = await insertSingleContractActionRecord(requestInfo)

    // approve
    const approveConfig = {
        referenceId: contractActionRecord.id, 
        senderCircleWalletId: circleWalletId, 
        currency: "usdc", 
        spender: tokenMessengerInfo.address, 
        unitsAmount: amount, 
        chain, 
        providerRecordId: circleTransactionRecord.id, 
        transferType: "CONTRACT_ACTION"
    }

    const {response, responseBody, mainTableStatus, providerStatus} = await approveAction("CIRCLE", approveConfig)
    
    const toUpdateContractActionRecord = {
        status: mainTableStatus,
        updated_at: new Date().toISOString()
    }

    // map response
    if (!response.ok) {
        await createLog("smartContract/_circleApprove", userId, responseBody.message, responseBody)
         // update to contract action record
         toUpdateContractActionRecord.failed_reason = "Please contact HIFI for more information"
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)
    return {success: response.ok, record: updatedContractActionRecord}
}


const approveToTokenMessenger = async (amount, chain, userId, walletType) => {
    const {address: walletAddress, bastionUserId, circleWalletId, walletProvider} = await getUserWallet(userId, chain, walletType)
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

    let updatedRecord
    if (walletProvider == "BASTION"){
        const {success, record} = await _bastionApprove(userId, chain, walletAddress, bastionUserId, amount, tokenMessengerInfo, usdcContractAddress)
        return {success, record, errorMessageForCustomer: record.failed_reason}
    }else if (walletProvider == "CIRCLE"){
        const {success, record} = await _circleApprove(userId, chain, walletAddress, circleWalletId, amount, tokenMessengerInfo, usdcContractAddress)
        return {success, record, errorMessageForCustomer: record.failed_reason}
    }else{
        throw new Error("Unsupported wallet provider: " + walletProvider)
    }

}

module.exports = { approveToTokenMessenger }
