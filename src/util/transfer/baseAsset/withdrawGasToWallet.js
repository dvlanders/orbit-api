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
const { insertWalletTransactionRecord, getWalletColumnNameFromProvider, transferBaseAssetToWallet } = require("../walletOperations/utils")
const { updateBaseAssetTransactionRecord } = require("./utils/baseAssetTransactionTableService")
const { getUserWallet } = require("../../user/getUserWallet")
const { transferType } = require("../utils/transfer")

const insertRecord = async(fields) => {
    const { senderUserId, amount, requestId, recipientAddress, chain, currency, senderWalletAddress, walletProvider, newRecord } = fields
    // insert record in provider table
    const toInsert = {user_id: senderUserId, request_id: v4()};
    const walletTxRecord = await insertWalletTransactionRecord(walletProvider, toInsert);
    const walletColName = getWalletColumnNameFromProvider(walletProvider);

    // insert record to base_asset_transactions
    const toUpdateBaseAssetTransaction = {
        sender_user_id: senderUserId,
        amount_in_wei: toUnitsString(amount, 18),
        amount: amount,
        recipient_wallet_address: recipientAddress,
        sender_wallet_address: senderWalletAddress,
        chain: chain,
        wallet_provider: walletProvider,
        transfer_from_wallet_type: "GAS_STATION",
        status: "CREATED",
        [walletColName]: walletTxRecord.id,
    }

    const record = await updateBaseAssetTransactionRecord(newRecord.id, toUpdateBaseAssetTransaction)
    return record
}

const createBaseAssetTransfer = async(fields) => {
    const { senderUserId, chain, profileId } = fields
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
    const chain = record.chain
    const recipientAddress = record.recipient_wallet_address
    const senderUserId = record.sender_user_id
    const walletType = record.transfer_from_wallet_type
    const {bastionUserId, circleWalletId, walletProvider} = await getUserWallet(senderUserId, chain, walletType)
    const walletColName = getWalletColumnNameFromProvider(walletProvider)

    const transferConfig = {
        referenceId: record.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        amountInEther: amount, 
        chain, 
        destinationAddress: recipientAddress, 
        transferType: transferType.BASE_ASSET, 
        providerRecordId: record[walletColName]
    }

    const {response, responseBody, mainTableStatus, failedReason} = await transferBaseAssetToWallet(walletProvider, transferConfig)
    const toUpdate = {
        status: mainTableStatus,
        updated_at: new Date().toISOString()
    }

    if (!response.ok) {
        toUpdate.failed_reason = failedReason
    }

    await updateBaseAssetTransactionRecord(record.id, toUpdate)

    // send notification
    await notifyBaseAssetWithdraw(record)

    //return record
    return await fetchBaseAssetTransactionRecord(record.id, profileId)
}

const executeAsyncBaseAssetTransfer = async(config) => {
    // fetch from created record
	const {data, error} = await supabase
        .from('base_asset_transactions')
        .select("*, bastionTransaction:bastion_transaction_record_id(*), circleTransaction:circle_transaction_record_id(*)")
        .eq("id", config.recordId)
        .single()

    if (error) {
        await createLog("transfer/WithdrawGasToWallet/executeAsyncBaseAssetTransfer", config.userId, error.message)
        throw new Error("Error happened in executeAsyncBaseAssetTransfer")
    }

    // transfer
    return await transfer(data, config.profileId)
}

module.exports = {
    createBaseAssetTransfer,
    executeAsyncBaseAssetTransfer
}