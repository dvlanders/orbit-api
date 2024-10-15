const { v4 } = require("uuid")
const { submitUserAction } = require("../../bastion/endpoints/submitUserAction")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { safeParseBody } = require("../../utils/response")
const { messageTransmitter } = require("./utils")
const { getMappedError } = require("../../bastion/utils/errorMappings")
const { insertWalletTransactionRecord, submitWalletUserAction } = require("../../transfer/walletOperations/utils")
const { insertSingleContractActionRecord } = require("../../transfer/contractAction/contractActionTableService")
const { updateContractActionRecord } = require("../updateContractActionRecord")
const { getUserWallet } = require("../../user/getUserWallet")

const _receiveMessageAndMintBastion = async (userId, chain, bastionUserId, walletAddress, messageBytes, attestationSignature, messageTransmitterInfo) => {
    // insert provider record
    const requestId = v4()
    const toInsertProviderRecord = {
        user_id: userId,
        request_id: requestId,
        bastion_user_id: bastionUserId,
    }
    const providerRecord = await insertWalletTransactionRecord("BASTION", toInsertProviderRecord)

    // insert contract action record
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

    const toInsertContractActionRecord = {
        contract_address: messageTransmitterInfo.address,
        wallet_address: walletAddress,
        user_id: userId,
        wallet_provider: "BASTION",
        action_input: contractInput,
        tag: "RECEIVE_MESSAGE_AND_MINT",
        status: "CREATED",
        chain: chain
    }

    const contractActionRecord = await insertSingleContractActionRecord(toInsertContractActionRecord)

    // submit user action to bastion
    const userActionConfig = {
        senderBastionUserId: bastionUserId, 
        senderUserId: userId, 
        contractAddress: messageTransmitterInfo.address, 
        actionName: "receiveMessage", 
        chain: chain, 
        actionParams: contractInput, 
        transferType: transferType.CONTRACT_ACTION, 
        providerRecordId: providerRecord.id
    }

    const {response, responseBody, mainTableStatus, providerStatus} = await submitWalletUserAction("BASTION", userActionConfig)

    // update contract action record
    const toUpdateContractActionRecord = {
        updated_at: new Date().toISOString(),
        status: mainTableStatus,
    }

    if (!response.ok) {
        await createLog("smartContract/cctp/_receiveMessageAndMintBastion", userId, responseBody.message, responseBody)
        toUpdateContractActionRecord.failed_reason = "Please contact HIFI for more information"
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)
    return {success: response.ok, record: updatedContractActionRecord, errorMessageForCustomer: toUpdateContractActionRecord.failed_reason}
}

const _receiveMessageAndMintCircle = async (userId, chain, circleWalletId, walletAddress, messageBytes, attestationSignature, messageTransmitterInfo) => {
    // insert provider record
    const requestId = v4()
    const toInsertProviderRecord = {
        user_id: userId,
        request_id: requestId,
        circle_wallet_id: circleWalletId,
    }
    const providerRecord = await insertWalletTransactionRecord("CIRCLE", toInsertProviderRecord)

    // insert contract action record
    const contractInput = {
        functionName: "receiveMessage(bytes,bytes)",
        params: [
            messageBytes,
            attestationSignature
        ]
    }

    const toInsertContractActionRecord = {
        contract_address: messageTransmitterInfo.address,
        wallet_address: walletAddress,
        user_id: userId,
        wallet_provider: "CIRCLE",
        action_input: contractInput,
        tag: "RECEIVE_MESSAGE_AND_MINT",
        status: "CREATED",
        chain: chain
    }

    const contractActionRecord = await insertSingleContractActionRecord(toInsertContractActionRecord)

    // submit user action to bastion
    const userActionConfig = {
        referenceId: contractActionRecord.id, 
        senderCircleWalletId: circleWalletId, 
        actionName: contractInput.functionName, 
        actionParams: contractInput.params, 
        contractAddress: messageTransmitterInfo.address, 
        transferType: transferType.CONTRACT_ACTION, 
        providerRecordId: providerRecord.id
    }

    const {response, responseBody, mainTableStatus, providerStatus} = await submitWalletUserAction("CIRCLE", userActionConfig)

    // update contract action record
    const toUpdateContractActionRecord = {
        updated_at: new Date().toISOString(),
        status: mainTableStatus,
    }

    if (!response.ok) {
        await createLog("smartContract/cctp/_receiveMessageAndMintCircle", userId, responseBody.message, responseBody)
        toUpdateContractActionRecord.failed_reason = "Please contact HIFI for more information"
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)
    return {success: response.ok, record: updatedContractActionRecord, errorMessageForCustomer: toUpdateContractActionRecord.failed_reason}
}


const receiveMessageAndMint = async (userId, chain, walletType, messageBytes, attestationSignature) => {
    // get wallet info
    const {address, walletProvider, circleWalletId, bastionUserId} = await getUserWallet(userId, chain, walletType)

    // get message transmitter address
    const messageTransmitterInfo = messageTransmitter[chain]
    if (!messageTransmitterInfo) throw new Error("Message transmitter not found")

    if (walletProvider === "BASTION") {
        return _receiveMessageAndMintBastion(userId, chain, bastionUserId, address, messageBytes, attestationSignature, messageTransmitterInfo)
    } else if (walletProvider === "CIRCLE") {
        return _receiveMessageAndMintCircle(userId, chain, circleWalletId, address, messageBytes, attestationSignature, messageTransmitterInfo)
    } else {
        throw new Error("Invalid wallet provider")
    }
}

module.exports = { receiveMessageAndMint }