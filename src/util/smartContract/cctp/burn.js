const { v4 } = require("uuid")
const { currencyContractAddress } = require("../../common/blockchain")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { safeParseBody } = require("../../utils/response")
const { initContractInstance } = require("../common/contract")
const { tokenMessenger, addressToBytes32 } = require("./utils")
const { getMappedError } = require("../../bastion/utils/errorMappings")
const { getUserWallet } = require("../../user/getUserWallet")
const { insertWalletTransactionRecord, submitWalletUserAction } = require("../../transfer/walletOperations/utils")
const { insertSingleContractActionRecord } = require("../../transfer/contractAction/contractActionTableService")
const { transferType } = require("../../transfer/utils/transfer")
const { updateContractActionRecord } = require("../updateContractActionRecord")


const _burnUsdcBastion = async(amount, sourceChain, sourceUserId, sourceBastionUserId, sourceWalletAddress, recipientBytes32Address, tokenMessengerInfo, destinationTokenMessengerInfo, usdcContractAddress) => {
    // insert provider record
    const requestId = v4()
    const toInsertProviderRecord = {
        user_id: sourceUserId,
        bastion_user_id: sourceBastionUserId,
        request_id: requestId,
    }

    const providerRecord = await insertWalletTransactionRecord("BASTION", toInsertProviderRecord)

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
    const toInsertContractActionRecord = {
        contract_address: tokenMessengerInfo.address,
        wallet_address: sourceWalletAddress,
        user_id: sourceUserId,
        wallet_provider: "BASTION",
        action_input: contractInput,
        tag: "BURN_USDC_ON_SOURCE_CHAIN",
        status: "CREATED",
        chain: sourceChain,
        bastion_transaction_record_id: providerRecord.id
    }

    const contractActionRecord = await insertSingleContractActionRecord(toInsertContractActionRecord)

    // submit user action to bastion
    const userActionConfig = {
        senderBastionUserId: sourceBastionUserId, 
        senderUserId: sourceUserId, 
        contractAddress: tokenMessengerInfo.address, 
        actionName: "depositForBurn", 
        chain: sourceChain, 
        actionParams: contractInput, 
        transferType: transferType.CONTRACT_ACTION, 
        providerRecordId: providerRecord.id
    }

    const {response, responseBody, mainTableStatus, providerStatus} = await submitWalletUserAction("BASTION", userActionConfig)

    const toUpdateContractActionRecord = {
        updated_at: new Date().toISOString(),
        status: mainTableStatus,
    }

    if (!response.ok){
        toUpdateContractActionRecord.failed_reason = "Please contact HIFI for more information"
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)

    return {success: response.ok, record: updatedContractActionRecord, errorMessageForCustomer: updatedContractActionRecord.failed_reason}
}

const _burnUsdcCircle = async(amount, sourceChain, sourceUserId, sourceCircleWalletId, sourceWalletAddress, recipientBytes32Address, tokenMessengerInfo, destinationTokenMessengerInfo, usdcContractAddress) => {
    // insert provider record
    const requestId = v4()
    const toInsertProviderRecord = {
        user_id: sourceUserId,
        circle_wallet_id: sourceCircleWalletId,
        request_id: requestId,
    }

    const providerRecord = await insertWalletTransactionRecord("CIRCLE", toInsertProviderRecord)

    const contractInput = {
        functionName: "depositForBurn(uint256, uint32, bytes32, address)",
        params: [
            amount,
            destinationTokenMessengerInfo.domain,
            recipientBytes32Address,
            usdcContractAddress
        ]
    }

    // insert contract action record
    const toInsertContractActionRecord = {
        contract_address: tokenMessengerInfo.address,
        wallet_address: sourceWalletAddress,
        user_id: sourceUserId,
        wallet_provider: "CIRCLE",
        action_input: contractInput,
        tag: "BURN_USDC_ON_SOURCE_CHAIN",
        status: "CREATED",
        chain: sourceChain,
        circle_transaction_record_id: providerRecord.id
    }

    const contractActionRecord = await insertSingleContractActionRecord(toInsertContractActionRecord)

    // submit user action to bastion
    const userActionConfig = {
        referenceId: contractActionRecord.id, 
        senderCircleWalletId: sourceCircleWalletId, 
        actionName: contractInput.functionName, 
        actionParams: contractInput.params, 
        contractAddress: tokenMessengerInfo.address, 
        transferType: transferType.CONTRACT_ACTION, 
        providerRecordId: providerRecord.id
    }

    const {response, responseBody, mainTableStatus, providerStatus} = await submitWalletUserAction("CIRCLE", userActionConfig)

    const toUpdateContractActionRecord = {
        updated_at: new Date().toISOString(),
        status: mainTableStatus,
    }

    if (!response.ok){
        toUpdateContractActionRecord.failed_reason = "Please contact HIFI for more information"
    }

    const updatedContractActionRecord = await updateContractActionRecord(contractActionRecord.id, toUpdateContractActionRecord)

    return {success: response.ok, record: updatedContractActionRecord, errorMessageForCustomer: updatedContractActionRecord.failed_reason}
}

const burnUsdc = async(amount, sourceChain, destinationChain, sourceUserId, destinationUserId, sourceWalletType, destinationWalletType) => {
    // get wallet information
    const { address: sourceWalletAddress, walletProvider, bastionUserId, circleWalletId } = await getUserWallet(sourceUserId, sourceChain, sourceWalletType)
    const { address: destinationWalletAddress } = await getUserWallet(destinationUserId, destinationChain, destinationWalletType)

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

    if (walletProvider === "BASTION"){
        return _burnUsdcBastion(amount, sourceChain, sourceUserId, bastionUserId, sourceWalletAddress, recipientBytes32Address, tokenMessengerInfo, destinationTokenMessengerInfo, usdcContractAddress)
    }else if (walletProvider === "CIRCLE"){
        return _burnUsdcCircle(amount, sourceChain, sourceUserId, circleWalletId, sourceWalletAddress, recipientBytes32Address, tokenMessengerInfo, destinationTokenMessengerInfo, usdcContractAddress)
    }else{
        throw new Error("Unsupported wallet provider: " + walletProvider)
    }


}

module.exports = { burnUsdc }