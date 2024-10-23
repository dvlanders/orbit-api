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
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling")
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck")
const { isBastionKycPassed } = require("../../../common/privilegeCheck")
const { v4 } = require("uuid")


const insertRecord = async(fields) => {
    // insert record
    fields.bastionRequestId = v4()
    const requestRecord = await insertRequestRecord(fields)
    if (!fields.feeType || parseFloat(fields.feeValue) <= 0) return {validTransfer: true, record: requestRecord}

    // insert fee record
    // check if allowance is enough 
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
    const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, fields.amount)

    // fetch fee record if not create one
    const info = {
        chargedUserId: fields.senderUserId,
        chain: fields.chain,
        currency: fields.currency,
        chargedWalletAddress: fields.senderAddress
    }
    const feeRecord = await createNewFeeRecord(requestRecord.id, feeType, feePercent, feeAmount, fields.profileId, info, transferType.CRYPTO_TO_CRYPTO, fields.senderWalletProvider, requestRecord.bastion_request_id)
    // update into crypto to crypto table
    const record = await updateRequestRecord(requestRecord.id, {developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress})
    return {validTransfer: true, record}
}

const createBastionCryptoTransfer = async(fields) => {
    const { senderUserId, amount, requestId, recipientUserId, recipientAddress, chain, currency, feeType, feeValue, senderWalletType, recipientWalletType, senderAddress, senderBastionUserId, recipientBastionUserId, profileId, feeTransactionId } = fields
    // check privilege
    if (!(await isBastionKycPassed(senderBastionUserId))) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Sender wallet is not kyc passed")
    if (senderBastionUserId && !(await isBastionKycPassed(recipientBastionUserId))) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Recipient wallet is not kyc passed")
    // check amount
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

    // check if the user has enough balance for the transaction amount
    if(!await checkBalanceForTransactionAmount(senderUserId, amount, chain, currency, senderWalletType)){
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

    // perfrom transfer with fee
    await CryptoToCryptoWithFeeBastion(record, feeRecord, record.payment_processor_contract_address, profileId)

    // send notification
    await notifyCryptoToCryptoTransfer(record)
    
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const transferWithoutFee = async(record, profileId) => {
    const decimal = currencyDecimal[record.currency]
    const unitsAmount = toUnitsString(record.amount, decimal) 
    // transfer without fee
    const bodyObject = {
        requestId: record.bastion_request_id,
        userId: record.sender_bastion_user_id,
        contractAddress: record.contract_address,
        actionName: "transfer",
        chain: record.chain,
        actionParams: erc20Transfer(record.currency, record.chain, record.recipient_address, unitsAmount)
    };

    const response = await submitUserAction(bodyObject)
    const responseBody = await response.json()

    if (!response.ok) {
        await createLog("transfer/bastionTransfer/transferWithoutFee", record.sender_user_id, responseBody.message, responseBody)
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
            transaction_hash: responseBody.transactionHash,
            failed_reason: responseBody.failureDetails,
        }
        
        await updateRequestRecord(record.id, toUpdate)
    }

    // send notification
    await notifyCryptoToCryptoTransfer(record)

    //return record
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const executeAsyncBastionCryptoTransfer = async(config) => {
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
    CreateCryptoToCryptoTransferError,
    CreateCryptoToCryptoTransferErrorType,
}