const { v4 } = require("uuid")
const notifyBaseAssetWithdraw = require("../../../../webhooks/transfer/notifyBaseAssetWithdraw")
const transferBaseAsset = require("../../bastion/endpoints/transferBaseAsset")
const { getMappedError } = require("../../bastion/utils/errorMappings")
const { baseAssetMap } = require("../../common/blockchain")
const createLog = require("../../logger/supabaseLogger")
const supabase = require("../../supabaseClient")
const { supabaseCall } = require("../../supabaseWithRetry")
const { safeParseBody } = require("../../utils/response")
const fetchBaseAssetTransactionRecord = require("./fetchBaseAssetTransactionRecord")
const { updateRequestRecord } = require("./updateRequestRecord")
const createJob = require("../../../../asyncJobs/createJob")
const { toUnitsString } = require("../cryptoToCrypto/utils/toUnits")

const insertRecord = async(fields) => {
    const { senderUserId, amount, requestId, recipientAddress, chain, currency, senderAddress, senderBastionUserId } = fields
    // insert record
    const { data, error } = await supabaseCall(() => supabase
    .from('base_asset_transactions')
    .update(
        { 
            sender_user_id: senderUserId,
            amount_in_wei: toUnitsString(amount, 18),
            amount: amount,
            recipient_wallet_address: recipientAddress,
            sender_wallet_address: senderAddress,
            chain: chain,
            currency: currency,
            crypto_provider: "BASTION",
            transfer_from_wallet_type: "GAS_STATION",
            status: "CREATED",
            sender_bastion_user_id: senderBastionUserId,
            bastion_request_id: v4()
        },
    )
    .eq('request_id', requestId)
    .select("*")
    .single())

    if (error) throw error
    return data
}

const createBaseAssetTransfer = async(fields) => {
    const { senderUserId, amount, requestId, recipientAddress, chain, senderAddress, senderBastionUserId, profileId } = fields
    // get currency symbol for chain
    fields.currency = baseAssetMap[chain]
    // insert record
    const record = await insertRecord(fields)
    const receipt = await fetchBaseAssetTransactionRecord(record.id, profileId)
    // insert async job
    const jobConfig = {
        recordId: record.id
    }
    await createJob("baseAssetWithdraw", jobConfig, senderUserId, profileId)

    return receipt

}

const transfer = async(record, profileId) => {
    const amount = record.amount
    const requestId = record.bastion_request_id
    const bastionUserId = record.sender_bastion_user_id
    const chain = record.chain
    const recipientAddress = record.recipient_wallet_address
    const currency = record.currency

    const response = await transferBaseAsset(requestId, bastionUserId, chain, currency, amount, recipientAddress)
    const responseBody = await safeParseBody(response)

    if (!response.ok) {
        await createLog("transfer/WithdrawGasToWallet/transfer", record.sender_user_id, responseBody.message, responseBody)
        const {message, type} = getMappedError(responseBody.message)

         // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: "NOT_INITIATED",
            failed_reason: message
        }
        await updateRequestRecord(record.id, toUpdate)
    }else{
        // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
            bastion_status: responseBody.status,
            transaction_hash: responseBody.transactionHash,
            failed_reason: responseBody.failureDetails,
        }
        
        await updateRequestRecord(record.id, toUpdate)
    }

    // send notification
    await notifyBaseAssetWithdraw(record)

    //return record
    return await fetchBaseAssetTransactionRecord(record.id, profileId)
}

const executeAsyncBastionBaseAssetTransfer = async(config) => {
    // fetch from created record
	const {data, error} = await supabase
        .from('base_asset_transactions')
        .select("*")
        .eq("id", config.recordId)
        .single()

    if (error) {
        await createLog("transfer/WithdrawGasToWallet/executeAsyncBastionBaseAssetTransfer", config.userId, error.message)
        throw new Error("Error happened in executeAsyncBastionBaseAssetTransfer")
    }

    // transfer
    return await transfer(data, config.profileId)
}

module.exports = {
    createBaseAssetTransfer,
    executeAsyncBastionBaseAssetTransfer
}