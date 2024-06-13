const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const createLog = require("../../../logger/supabaseLogger")
const { transferType } = require("../../utils/transfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")

exports.transfer = async(fields) => {
    // convert to actual crypto amount
    const decimal = currencyDecimal[fields.currency]
    const unitsAmount = toUnitsString(fields.amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[fields.chain][fields.currency]
    fields.contractAddress = contractAddress

    
    // insert request record
    const requestRecord = await insertRequestRecord(fields)
    
    // transfer
    const response = await bastionTransfer(fields)
    const responseBody = await response.json()
    if (!response.ok) {
        createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
        throw new Error("Something went wrong when creating crypto transfer")
    }

    // update to database
    toUpdate = {
        bastionResponse: responseBody,
        status: responseBody.status,
        transactionHash: responseBody.transactionHash,
    }
    const record = await updateRequestRecord(fields.requestId, toUpdate)

    // return receipt
    const receipt =  {
        transferType: transferType.CRYPTO_TO_CRYPTO,
        transferDetails: {
            requestId: fields.requestId,
            senderUserId: fields.senderUserId,
            recipientUserId: fields.recipientUserId,
            recipientAddress: fields.recipientAddress,
            chain: fields.chain,
            currency: fields.currency,
            transactionHash: record.transaction_hash,
            createdAt: record.created_at,
            status: record.status,
            contractAddress: contractAddress,
        }
    }

    return receipt
}