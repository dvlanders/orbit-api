const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const bastionGasCheck = require("../../../bastion/utils/gasCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const createLog = require("../../../logger/supabaseLogger")
const { chargeDeveloperFeeBastion } = require("../../fee/chargeDeveloperFeeBastion")
const { getFeeConfig } = require("../../fee/utils")
const { transferType } = require("../../utils/transfer")
const { CreateCryptoToCryptoTransferError, CreateCryptoToCryptoTransferErrorType } = require("../utils/createTransfer")
const { toUnitsString } = require("../utils/toUnits")
const { insertRequestRecord } = require("./insertRequestRecord")
const { updateRequestRecord } = require("./updateRequestRecord")


const bastionCryptoTransfer = async(fields) => {
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
    const response = await bastionTransfer(requestRecord.id, fields)
    const responseBody = await response.json()
    let fee
    if (!response.ok) {
        createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
        if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
            failedReason = "Transfer amount exceeds balance"
            // throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "transfer amount exceeds balance")
        }else{
            failedReason = "Not enough gas, please contact HIFI for more information"
            // throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR, responseBody.message)
        }

         // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: "FAILED",
            failed_reason: failedReason
        }
        record = await updateRequestRecord(requestRecord.id, toUpdate)
    }else{
        //charge fee when is not failed
        if (responseBody.status != "FAILED"){
            // charge fee
            if (fields.feeType && parseFloat(fields.feeValue) > 0){
                const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, fields.amount)
                const developer_fee_id = await chargeDeveloperFeeBastion(requestRecord.id, "CRYPTO_TO_CRYPTO", feeType, feePercent, feeAmount, fields.senderUserId, fields.profileId, fields.chain, fields.currency)
                fee = {
                    feeId: developer_fee_id,
                    feeType,
                    feePercent,
                    feeAmount
                }
            }
        }
        
        // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: responseBody.status,
            transaction_hash: responseBody.transactionHash,
            failed_reason: failedReason,
            developer_fee_id: fee.feeId
        }
        
        record = await updateRequestRecord(requestRecord.id, toUpdate)
    }

    // gas check
    await bastionGasCheck(fields.senderUserId, fields.chain)


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
            fee,
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