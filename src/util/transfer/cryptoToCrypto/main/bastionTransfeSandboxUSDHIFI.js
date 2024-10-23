const createJob = require("../../../../../asyncJobs/createJob")
const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { isValidAmount } = require("../../../common/transferValidation")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount")
const { CryptoToCryptoWithFeeBastion } = require("../../fee/CryptoToCryptoWithFeeBastion")
const { getFeeConfig } = require("../../fee/utils")
const { transferType } = require("../../utils/transfer")
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")
const { cryptoToCryptoTransferScheduleCheck } = require("../../../../../asyncJobs/transfer/cryptoTocryptoTransfer/scheduleCheck")
const supabase = require("../../../supabaseClient")
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord")
const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap")
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const fetchCryptoToCryptoTransferRecord = require("./fetchTransferRecord")
const notifyCryptoToCryptoTransfer = require("../../../../../webhooks/transfer/notifyCryptoToCryptoTransfer")
const { supabaseCall } = require("../../../supabaseWithRetry")
const { transferUSDHIFI } = require("../../../smartContract/sandboxUSDHIFI/transfer")
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck")
const { v4 } = require("uuid")
const { insertSingleBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService")

const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'

const insertRecord = async(fields) => {
    // insert provider record
    const toInsert = {
        user_id: fields.userId,
        request_id: fields.requestId,
        bastion_user_id: gasStation,
    }
    const providerRecord = await insertSingleBastionTransactionRecord(toInsert)

    // get billing tags
    const billingTags = fields.recipientUserId ? {
        success: ["internal"],
        failed: [],
    } : {
        success: ["external"],
        failed: [""],
    }

    // insert record
    const { data: requestRecord, error } = await supabaseCall(() => supabase
    .from('crypto_to_crypto')
    .update(
        { 
            sender_user_id: fields.senderUserId,
            amount: fields.amount,
            recipient_user_id: fields.recipientUserId ? fields.recipientUserId : null,
            recipient_address: fields.recipientAddress,
            sender_address: fields.senderAddress,
            chain: fields.chain,
            units_amount: fields.unitsAmount,
            currency: fields.currency,
            contract_address: fields.contractAddress,
            provider: "BASTION",
            transfer_from_wallet_type: fields.senderWalletType,
            transfer_to_wallet_type: fields.recipientWalletType,
            status: "CREATED",
            recipient_bastion_user_id: fields.recipientBastionUserId,
            billing_tags_success: billingTags.success,
            billing_tags_failed: billingTags.failed,
            fee_transaction_id: fields.feeTransactionId,
            bastion_transaction_record_id: providerRecord.id,
        },
    )
    .eq("request_id", fields.requestId)
    .select("*")
    .single())

    if (error) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, error.message)


    if (!fields.feeType || parseFloat(fields.feeValue) <= 0) return {validTransfer: true, record: requestRecord}

    // insert fee record
    const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][fields.chain]
    if (!paymentProcessorContractAddress) {
        // no paymentProcessorContract available
        const toUpdate = {
            status: "FAILED",
            failed_reason: `Fee feature not available for ${fields.currency} on ${fields.chain}`
        }
        const record = await updateRequestRecord(requestRecord.id, toUpdate)
        return {validTransfer: false, record}
    }
    const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, fields.amount)

    // fetch fee record if not create one
    const info = {
        chargedUserId: fields.senderUserId,
        chain: fields.chain,
        currency: fields.currency,
        chargedWalletAddress: fields.senderAddress
    }
    const feeRecord = await createNewFeeRecord(requestRecord.id, feeType, feePercent, feeAmount, fields.profileId, info, transferType.CRYPTO_TO_CRYPTO, "BASTION", null, {bastion_transaction_record_id: providerRecord.id})
    // update into crypto to crypto table
    const record = await updateRequestRecord(requestRecord.id, {developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress})
    return {validTransfer: true, record: requestRecord}
}

const createBastionSandboxCryptoTransfer = async(fields) => {
    const { senderUserId, amount, chain, currency, profileId, senderBastionUserId, feeTransactionId } = fields
    if (!isValidAmount(amount, 0.01)) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 0.01.")
    // convert to actual crypto amount
    const decimal = currencyDecimal[currency]
    const unitsAmount = toUnitsString(amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[chain][currency]
    fields.contractAddress = contractAddress
    // insert record
    const {validTransfer, record} = await insertRecord(fields)
    const receipt = await fetchCryptoToCryptoTransferRecord(record.id, profileId)
    if (!validTransfer) return receipt

    if(!await checkBalanceForTransactionAmount(senderBastionUserId, amount, chain, currency)){
        const toUpdate = {
            status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        await updateRequestRecord(record.id, toUpdate)
        return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
    }

    // insert async job
    const jobConfig = {
        recordId: record.id
    }
    await createJob("cryptoToCryptoTransferSandbox", jobConfig, senderUserId, profileId)

    return receipt

}

// FIXME fee charge currently not allowed
const transferWithFee = async(record, profileId) => {
    // get fee record
    const {data: feeRecord, error} = await supabase
        .from("developer_fees")
        .select("*")
        .eq("id", record.developer_fee_id)
        .single()
        
    if (error) throw error

    // perfrom transfer with fee
    await CryptoToCryptoWithFeeBastion(record, feeRecord, record.payment_processor_contract_address, profileId)
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const transferWithoutFee = async(record, profileId) => {

    const transferConfig = {
        providerRecordId: record.bastion_transaction_record_id,
        fromWalletAddress: record.sender_address,
        currency: record.currency,
        unitsAmount: record.units_amount,
        chain: record.chain,
        userId: record.sender_user_id,
        toWalletAddress: record.recipient_address,
        transferType: transferType.CRYPTO_TO_CRYPTO
    }
    const {response, responseBody, mainTableStatus, providerStatus, failedReason} = await transferUSDHIFI(transferConfig)

     // update crypto to crypto record
     const toUpdateCryptoToCrypto ={
        status: mainTableStatus,
        updated_at: new Date().toISOString()
    }
    if (!response.ok) {
        // before fixing the smart contract default as Not enough error
        await createLog("transfer/bastionTransferSandboxUSDHIFI/transferWithoutFee", record.sender_user_id, responseBody.message, responseBody)
        toUpdateCryptoToCrypto.failed_reason = failedReason
    }
    
    await updateRequestRecord(record.id, toUpdateCryptoToCrypto)
    // send notification
    await notifyCryptoToCryptoTransfer(record)
}

const executeAsyncBastionSandboxCryptoTransfer = async(config) => {
    // fetch from created record
	const {data, error} = await supabase
    .from('crypto_to_crypto')
    .select("*")
    .eq("id", config.recordId)
    .single()

    if (error) {
        await createLog("transfer/util/createTransferToBridgeLiquidationAddress", config.userId, error.message)
        throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, "Unexpected error happened")
    }

    // transfer
    if (data.developer_fee_id){
        return await transferWithFee(data, config.profileId)
    }else{
        return await transferWithoutFee(data, config.profileId)
    }
}

module.exports = {
    createBastionSandboxCryptoTransfer,
    executeAsyncBastionSandboxCryptoTransfer
}