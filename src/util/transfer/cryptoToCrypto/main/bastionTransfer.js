const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const bastionGasCheck = require("../../../bastion/utils/gasCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap } = require("../../../smartContract/approve/approveTokenBastion")
const { getTokenAllowance } = require("../../../smartContract/approve/getApproveAmount")
const { CryptoToCryptoWithFeeBastion } = require("../../fee/CryptoToCryptoWithFeeBastion")
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

    // insert request record
    const requestRecord = await insertRequestRecord(fields)

    if (fields.feeType && parseFloat(fields.feeValue) > 0){
        // transfer with fee charged
        // check if allowance is enough 
        const paymentProcessorContractAddress = paymentProcessorContractMap[process.env.NODE_ENV][fields.chain]
        if (!paymentProcessorContractAddress) {
            // no paymentProcessorContract available
            const toUpdate = {
                status: "FAILED",
                failed_reason: `Fee feature not available for ${fields.currency} on ${fields.chain}`
            }
            record = await updateRequestRecord(requestRecord.id, toUpdate)
            return {
                transferType: transferType.CRYPTO_TO_CRYPTO,
                transferDetails: {
                    id: record.id,
                    requestId: fields.requestId,
                    senderUserId: fields.senderUserId,
                    recipientUserId: fields.recipientUserId || null,
                    recipientAddress: fields.recipientAddress,
                    chain: fields.chain,
                    currency: fields.currency,
                    amount: fields.amount,
                    transactionHash: null,
                    createdAt: record.created_at,
                    updatedAt: record.updatedAt,
                    status: "FAILED",
                    contractAddress: contractAddress,
                    failedReason: toUpdate.failed_reason,
                    fee: {
                        feeId: null,
                        feeType,
                        feeAmount,
                        feePercent,
                        status: "FAILED",
                        transactionHash: null,
                        failedReason: `Fee feature not available for ${fields.currency} on ${fields.chain}`
                    },
                }
            }
        }
        const allowance = await getTokenAllowance(fields.chain, fields.currency, fields.senderAddress, paymentProcessorContractAddress)
        const {feeType, feePercent, feeAmount} = getFeeConfig(fields.feeType, fields.feeValue, fields.amount)
        if (allowance < unitsAmount){
            // not enough allowance, perform a token allowance job and then schedule a token transfer job

        }else{
            // perfrom transfer with fee
            const receipt = await CryptoToCryptoWithFeeBastion(requestRecord.id, paymentProcessorContractAddress, feeType, feePercent, feeAmount, fields.profileId, fields)
            // gas check
            await bastionGasCheck(fields.senderUserId, fields.chain)
            return receipt
        }

    }else{
        // transfer without fee
        let record
        let failedReason
        const response = await bastionTransfer(requestRecord.id, fields)
        const responseBody = await response.json()
        if (!response.ok) {
            createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
            if (responseBody.message == "execution reverted: ERC20: transfer amount exceeds balance"){
                failedReason = "Transfer amount exceeds balance"
            }else if (responseBody.message == "gas required exceeds allowance (7717)"){
                failedReason = "Not enough gas, please contact HIFI for more information"
            }else{
                failedReason = "Please contact HIFI for more information"
            }
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
                failed_reason: responseBody.failureDetails,
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
                amount: fields.amount,
                transactionHash: record.transaction_hash,
                createdAt: record.created_at,
                updatedAt: record.updatedAt,
                status: record.status,
                contractAddress: fields.contractAddress,
                failedReason: record.failed_reason
            }
        }
    
        return receipt
    }
    
}


module.exports = {
    bastionCryptoTransfer,
    CreateCryptoToCryptoTransferError,
    CreateCryptoToCryptoTransferErrorType

}