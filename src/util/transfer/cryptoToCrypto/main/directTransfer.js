const createJob = require("../../../../../asyncJobs/createJob")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { isValidAmount } = require("../../../common/transferValidation")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveToken")
const { getFeeConfig } = require("../../fee/utils")
const { transferType } = require("../../utils/transfer")
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")
const supabase = require("../../../supabaseClient")
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord")
const fetchCryptoToCryptoTransferRecord = require("./fetchTransferRecord")
const notifyCryptoToCryptoTransfer = require("../../../../../webhooks/transfer/notifyCryptoToCryptoTransfer")
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling")
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck")
const { v4 } = require("uuid")
const { getUserWallet } = require("../../../user/getUserWallet")
const { updateFeeRecord } = require("../../fee/updateFeeRecord")
const { getWalletColumnNameFromProvider, insertWalletTransactionRecord, transferToWallet, transferToWalletWithPP } = require("../../walletOperations/utils")
const { safeSum } = require("../../../utils/number")

const insertRecord = async(fields) => {
    // insert record in provider table
    const toInsert = {user_id: fields.senderUserId, request_id: v4()};
    const walletTxRecord = await insertWalletTransactionRecord(fields.senderWalletProvider, toInsert);
    const walletColName = getWalletColumnNameFromProvider(fields.senderWalletProvider);
    const amount = parseFloat(fields.amount)
    fields[walletColName] = walletTxRecord.id;
    // insert record
    const requestRecord = await insertRequestRecord(fields)
    // return if no fee
    if (!fields.feeType || parseFloat(fields.feeValue) <= 0) return {validTransfer: true, record: requestRecord}

    // insert fee record
    const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][fields.chain]
    if (!paymentProcessorContractAddress) {
        // no paymentProcessorContract available
        const toUpdate = {
            status: "NOT_INITIATED",
            failed_reason: `Fee feature not available for ${fields.currency} on ${fields.chain}`
        }
        const record = await updateRequestRecord(requestRecord.id, toUpdate)
        return {validTransfer: false, record}
    }
    const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, amount)

    // create new fee record
    const info = {
        chargedUserId: fields.senderUserId,
        chain: fields.chain,
        currency: fields.currency,
        chargedWalletAddress: fields.senderAddress
    }
    const feeRecord = await createNewFeeRecord(requestRecord.id, feeType, feePercent, feeAmount, fields.profileId, info, transferType.CRYPTO_TO_CRYPTO, fields.senderWalletProvider, null, {[walletColName]: walletTxRecord.id})
    // update into crypto to crypto table
    const amountIncludeDeveloperFee = parseFloat(safeSum([amount, feeAmount]).toFixed(2))
    const record = await updateRequestRecord(requestRecord.id, {developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress, amount_include_developer_fee: amountIncludeDeveloperFee})
    return {validTransfer: true, record}
}

const createDirectCryptoTransfer = async(fields) => {
    const { senderUserId, amount, requestId, recipientUserId, recipientAddress, chain, currency, feeType, feeValue, senderWalletType, recipientWalletType, senderAddress, profileId, feeTransactionId, senderCircleWalletId } = fields
    if (!isValidAmount(amount, 0.01)) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 0.01.")
    // convert to actual crypto amount
    const decimal = currencyDecimal[currency]
    const unitsAmount = toUnitsString(amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[chain][currency]
    fields.contractAddress = contractAddress
    // insert record
    let {validTransfer, record} = await insertRecord(fields)
    const receipt = await fetchCryptoToCryptoTransferRecord(record.id, profileId)
    if (!validTransfer) return receipt

    // if the user does not have enough balance for the transaction fee, then fail the transaction
    if(!await checkBalanceForTransactionFee(record.id, transferType.CRYPTO_TO_CRYPTO)){
        const toUpdate = {
            status: "NOT_INITIATED",
            failed_reason: "Insufficient balance for transaction fee"
        }
        record = await updateRequestRecord(record.id, toUpdate)
        return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
    }

    const amountToCheck = Math.max(record.amount, record.amount_include_developer_fee)
    // check if the user has enough balance for the transaction amount
    if(!await checkBalanceForTransactionAmount(senderUserId, amountToCheck, chain, currency, senderWalletType)){
        const toUpdate = {
            status: "NOT_INITIATED",
            failed_reason: "Transfer amount exceeds wallet balance"
        }
        record = await updateRequestRecord(record.id, toUpdate)
        return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
    }

    // insert async job
    const jobConfig = {
        recordId: record.id
    }
    await createJob("cryptoToCryptoTransfer", jobConfig, senderUserId, profileId)

    return receipt

}

const transferWithFee = async(record, profileId) => {
    // get fee record
    const {data: feeRecord, error} = await supabase
        .from("developer_fees")
        .select("*")
        .eq("id", record.developer_fee_id)
        .single()
        
    if (error) throw error

    // fetch sender wallet information
    const {circleWalletId, bastionUserId} = await getUserWallet(record.sender_user_id, record.chain, record.transfer_from_wallet_type)
    const paymentProcessorContractAddress = record.payment_processor_contract_address
    const feeCollectionWalletAddress = feeRecord.fee_collection_wallet_address
    const feeUnitsAmount = toUnitsString(feeRecord.fee_amount, currencyDecimal[feeRecord.fee_collection_currency])
    const unitsAmount = toUnitsString(record.amount, currencyDecimal[record.currency]) 
    const providerRecordId = record[getWalletColumnNameFromProvider(record.provider)]

    // perfrom transfer with fee
    const transferConfig = {
        referenceId: record.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: record.currency, 
        unitsAmount, 
        chain: record.chain, 
        destinationAddress: record.recipient_address, 
        transferType: transferType.CRYPTO_TO_CRYPTO,
        paymentProcessorContract: paymentProcessorContractAddress,
        feeUnitsAmount: feeUnitsAmount,
        feeCollectionWalletAddress: feeCollectionWalletAddress,
        providerRecordId,
        paymentProcessType: "EXACT_OUT"
    }

    const {response, responseBody, mainTableStatus, providerStatus, failedReason, feeRecordStatus} = await transferToWalletWithPP(record.provider, transferConfig);

    // update crypto to crypto record
    const toUpdateCryptoToCrypto ={
        status: mainTableStatus,
        updated_at: new Date().toISOString(),
    }
    const toUpdateFeeRecord = {
        charged_status: feeRecordStatus,
        updated_at: new Date().toISOString(),
    }
    if (!response.ok) {
        await createLog("transfer/circleTransfer/transferWithoutFee", record.sender_user_id, responseBody.message, responseBody)
        toUpdateCryptoToCrypto.failed_reason = failedReason
        toUpdateFeeRecord.failed_reason = failedReason
    }
    await Promise.all([
        updateRequestRecord(record.id, toUpdateCryptoToCrypto),
        updateFeeRecord(feeRecord.id, toUpdateFeeRecord)
    ])
    // send notification
    await notifyCryptoToCryptoTransfer(record)
    
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const transferWithoutFee = async(record, profileId) => {

    // fetch sender wallet information
    const {circleWalletId, bastionUserId} = await getUserWallet(record.sender_user_id, record.chain, record.transfer_from_wallet_type)
    const providerRecordId = record[getWalletColumnNameFromProvider(record.provider)]
    const decimal = currencyDecimal[record.currency]
    const unitsAmount = toUnitsString(record.amount, decimal) 

    const transferConfig = {
        referenceId: record.id, 
        senderCircleWalletId: circleWalletId, 
        senderBastionUserId: bastionUserId,
        currency: record.currency, 
        unitsAmount, 
        chain: record.chain, 
        destinationAddress: record.recipient_address, 
        transferType: transferType.CRYPTO_TO_CRYPTO,
        providerRecordId
    }
    
    const {response, responseBody, mainTableStatus, providerStatus, failedReason} = await transferToWallet(record.provider, transferConfig);

    // update crypto to crypto record
    const toUpdateCryptoToCrypto ={
        status: mainTableStatus,
        updated_at: new Date().toISOString(),
    }
    if (!response.ok) {
        await createLog("transfer/circleTransfer/transferWithoutFee", record.sender_user_id, responseBody.message, responseBody)
        toUpdateCryptoToCrypto.failed_reason = failedReason
    }

    await updateRequestRecord(record.id, toUpdateCryptoToCrypto)

    // send notification
    await notifyCryptoToCryptoTransfer(record)

    //return record
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const executeAsyncDirectCryptoTransfer = async(config) => {
    // fetch from created record
	const {data, error} = await supabase
    .from('crypto_to_crypto')
    .select("*")
    .eq("id", config.recordId)
    .single()

    if (error) {
        await createLog("transfer/util/executeAsyncDirectCryptoTransfer", config.userId, error.message)
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
    createDirectCryptoTransfer,
    executeAsyncDirectCryptoTransfer
}