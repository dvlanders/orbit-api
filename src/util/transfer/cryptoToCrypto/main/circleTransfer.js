const createJob = require("../../../../../asyncJobs/createJob")
const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { isValidAmount } = require("../../../common/transferValidation")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveToken")
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount")
const { CryptoToCryptoWithFeeBastion } = require("../../fee/CryptoToCryptoWithFeeBastion")
const { getFeeConfig } = require("../../fee/utils")
const { transferType } = require("../../utils/transfer")
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")
const supabase = require("../../../supabaseClient")
const { createNewFeeRecord } = require("../../fee/createNewFeeRecord")
const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap")
const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const fetchCryptoToCryptoTransferRecord = require("./fetchTransferRecord")
const notifyCryptoToCryptoTransfer = require("../../../../../webhooks/transfer/notifyCryptoToCryptoTransfer")
const { checkBalanceForTransactionFee } = require("../../../billing/fee/transactionFeeBilling")
const { checkBalanceForTransactionAmount } = require("../../../bastion/utils/balanceCheck")
const { v4 } = require("uuid")
const { insertSingleCircleTransactionRecord, updateCircleTransactionRecord } = require("../../../circle/main/circleTransactionTableService")
const { chargeFeeCircle } = require("../../fee/chargeFeeCircle")
const { getUserWallet } = require("../../../user/getUserWallet")
const { erc20TransferWithFunctionName } = require("../../../smartContract/utils/erc20")
const { submitTransactionCircle } = require("../../../circle/main/submitTransaction")
const { safeParseBody } = require("../../../utils/response")

const statusMap = {
    "INITIATED": "SUBMITTED",
    "QUEUED": "PENDING",
	"PENDING_RISK_SCREENING": "PENDING",
	"SENT": "PENDING",
	"CONFIRMED": "PENDING",
	"COMPLETE": "CONFIRMED",
	"CANCELED": "CANCELED",
	"FAILED": "FAILED",
	"DENIED": "FAILED",
	"ACCELERATED": "PENDING"
}


const insertRecord = async(fields) => {
    // insert circle transaction record
    // the requestId should be shared with feeRecord and circleTransactionRecord
    const requestId = v4()
    const toInsertCircleTransaction = {
        user_id: fields.senderUserId,
        request_id: requestId,
        circle_wallet_id: fields.senderCircleWalletId,
    }
    const circleTransactionRecord = await insertSingleCircleTransactionRecord(toInsertCircleTransaction)
    fields.circleTransactionId = circleTransactionRecord.id

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
    const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, fields.amount)

    // fetch fee record if not create one
    const info = {
        chargedUserId: fields.senderUserId,
        chain: fields.chain,
        currency: fields.currency,
        chargedWalletAddress: fields.senderAddress
    }
    const feeRecord = await createNewFeeRecord(requestRecord.id, feeType, feePercent, feeAmount, fields.profileId, info, transferType.CRYPTO_TO_CRYPTO, fields.senderWalletProvider, requestId)
    // update into crypto to crypto table
    const record = await updateRequestRecord(requestRecord.id, {developer_fee_id: feeRecord.id, payment_processor_contract_address: paymentProcessorContractAddress})
    return {validTransfer: true, record}
}

const createCircleCryptoTransfer = async(fields) => {
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
    const {updatedFeeRecord, submittedSuccessfully, responseBody} = await chargeFeeCircle(record, feeRecord, record.payment_processor_contract_address, record.recipient_address, record.units_amount, record.circleTransaction.circle_wallet_id)

    // update circle transaction record
    const toUpdateCircleTransaction = {
        circle_status: responseBody.data.state,
        circle_transaction_id: responseBody.data.id,
        circle_response: responseBody,
        updated_at: new Date().toISOString()
    }
    // update crypto to crypto record
    const toUpdateCryptoToCrypto = {
        status: submittedSuccessfully ? "SUBMITTED" : "NOT_INITIATED",
        updated_at: new Date().toISOString()
    }

    await Promise.all([
        updateRequestRecord(record.id, toUpdateCryptoToCrypto),
        updateCircleTransactionRecord(record.circle_transaction_record_id, toUpdateCircleTransaction)
    ])
    // send notification
    await notifyCryptoToCryptoTransfer(record)
    
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const transferWithoutFee = async(record, profileId) => {
    const decimal = currencyDecimal[record.currency]
    const unitsAmount = toUnitsString(record.amount, decimal) 
    const transferFunction = erc20TransferWithFunctionName(record.currency, record.recipient_address, unitsAmount)

    const response = await submitTransactionCircle(record.id, record.circleTransaction.request_id, record.circleTransaction.circle_wallet_id, record.contract_address, transferFunction.functionName, transferFunction.params)
    const responseBody = await safeParseBody(response)

    let toUpdateCryptoToCrypto, toUpdateCircleTransaction
    if (!response.ok) {
        await createLog("transfer/circleTransfer/transferWithoutFee", record.sender_user_id, responseBody.message, responseBody)
        const {message, type} = getMappedError(responseBody.message)
        // update circle transaction record
        toUpdateCircleTransaction = {
            circle_status: "FAILED",
            circle_response: responseBody,
            updated_at: new Date().toISOString()
        }
        // update crypto to crypto record
        toUpdateCryptoToCrypto = {
            status: "NOT_INITIATED",
            failed_reason: message,
            updated_at: new Date().toISOString()
        }
    }else{
        // update circle transaction record
        toUpdateCircleTransaction = {
            circle_status: responseBody.data.state,
            circle_transaction_id: responseBody.data.id,
            circle_response: responseBody,
            updated_at: new Date().toISOString()
        }

        // update crypto to crypto record
        toUpdateCryptoToCrypto = {
            status: statusMap[responseBody.data.state],
            updated_at: new Date().toISOString()
        }
    }

    // update records
    await Promise.all([
        updateRequestRecord(record.id, toUpdateCryptoToCrypto),
        updateCircleTransactionRecord(record.circle_transaction_record_id, toUpdateCircleTransaction)
    ])

    // send notification
    await notifyCryptoToCryptoTransfer(record)

    //return record
    return await fetchCryptoToCryptoTransferRecord(record.id, profileId)
}

const executeAsyncCircleCryptoTransfer = async(config) => {
    // fetch from created record
	const {data, error} = await supabase
    .from('crypto_to_crypto')
    .select("*, circleTransaction: circle_transaction_record_id(*)")
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
