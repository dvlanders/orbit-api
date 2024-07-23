const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const bastionGasCheck = require("../../../bastion/utils/gasCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { isValidAmount } = require("../../../common/transferValidation")
const { getMappedError } = require("../utils/errorMappings")
const createLog = require("../../../logger/supabaseLogger")
const { transferType } = require("../../utils/transfer")
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")


const bastionCryptoTransfer = async(fields) => {
    if (!isValidAmount(fields.amount, 0.01)) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 0.01.")
    // convert to actual crypto amount
    const decimal = currencyDecimal[fields.currency]
    const unitsAmount = toUnitsString(fields.amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[fields.chain][fields.currency]
    fields.contractAddress = contractAddress
    fields.provider = "BASTION"
    
    let record
    let failedReason
    // insert request record
    const requestRecord = await insertRequestRecord(fields)
    
    // transfer
    const response = await bastionTransfer(requestRecord.bastion_request_id, fields)
    const responseBody = await response.json()

    // gas check
    await bastionGasCheck(fields.senderUserId, fields.chain)

    if (!response.ok) {
        await createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
        const { message, type } = getMappedError(responseBody.message)
        failedReason = message

         // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: "FAILED",
            failed_reason: failedReason
        }
        record = await updateRequestRecord(requestRecord.id, toUpdate)
    }else{
        // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
            transaction_hash: responseBody.transactionHash,
            failed_reason: failedReason
        }
        record = await updateRequestRecord(requestRecord.id, toUpdate)
    }


    // return receipt
    const receipt =  {
        transferType: transferType.CRYPTO_TO_CRYPTO,
        transferDetails: {
            id: record.id,
            requestId: fields.requestId,
            senderUserId: fields.senderUserId,
            recipientUserId: fields.recipientUserId || null,
            recipientAddress: fields.recipientAddress,
            chain: fields.chain,
            currency: fields.currency,
            amount: record.amount,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            updatedAt: record.updatedAt,
            status: record.status,
            contractAddress: contractAddress,
            failedReason
        }
    }

    return receipt
}


module.exports = {
    bastionCryptoTransfer,
    CreateCryptoToCryptoTransferError,
    CreateCryptoToCryptoTransferErrorType

}