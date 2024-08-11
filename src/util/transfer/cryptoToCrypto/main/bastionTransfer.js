const createJob = require("../../../../../asyncJobs/createJob")
const { transfer: bastionTransfer } = require("../../../bastion/endpoints/transfer")
const { allowanceCheck } = require("../../../bastion/utils/allowanceCheck")
const bastionGasCheck = require("../../../bastion/utils/gasCheck")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { isValidAmount } = require("../../../common/transferValidation")
const createLog = require("../../../logger/supabaseLogger")
const { paymentProcessorContractMap, approveMaxTokenToPaymentProcessor } = require("../../../smartContract/approve/approveTokenBastion")
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



const bastionCryptoTransfer = async(fields, createdRecordId=null) => {
    if (!isValidAmount(fields.amount, 0.01)) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 0.01.")
    // convert to actual crypto amount
    const decimal = currencyDecimal[fields.currency]
    const unitsAmount = toUnitsString(fields.amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[fields.chain][fields.currency]
    fields.contractAddress = contractAddress
    fields.provider = "BASTION"
 
    // create or fetch request record
    let requestRecord
    if (!createdRecordId) {
        requestRecord = await insertRequestRecord(fields)
    }else{
        const {data: record, error} = await supabase
            .from("crypto_to_crypto")
            .select("*")
            .eq("id", createdRecordId)
            .eq("status", "CREATED")
            .maybeSingle()
        
        if (error) throw error
        if (!record) throw new Error(`No transfer record found for ${createdRecordId} or status is not CREATED`)
        requestRecord = record
    }

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

        // fetch fee record if not create one
        let feeRecord
        if (requestRecord.developer_fee_id){
            const {data: record, error} = await supabase
            .from("developer_fees")
            .select("*")
            .eq("id", requestRecord.developer_fee_id)
            .single()
        
            if (error) throw error
            if (!record) throw new Error(`No fee record found for ${requestRecord.developer_fee_id}`)
            feeRecord = record
        }else{
            const info = {
                chargedUserId: fields.senderUserId,
                chain: fields.chain,
                currency: fields.currency,
                chargedWalletAddress: fields.senderAddress
            }
            feeRecord = await createNewFeeRecord(requestRecord.id, feeType, feePercent, feeAmount, fields.profileId, info, transferType.CRYPTO_TO_CRYPTO, "BASTION", requestRecord.bastion_request_id)
            // update into crypto to crypto table
            await updateRequestRecord(requestRecord.id, {developer_fee_id: feeRecord.id})
        }

        if (allowance < BigInt(unitsAmount)){
            // not enough allowance, perform a token allowance job and then schedule a token transfer job
            await approveMaxTokenToPaymentProcessor(fields.senderUserId, fields.chain, fields.currency)
            const canSchedule = await cryptoToCryptoTransferScheduleCheck("cryptoToCryptoTransfer", {recordId: requestRecord.id}, fields.senderUserId, fields.profileId)
            if (canSchedule){
                await createJob("cryptoToCryptoTransfer", {recordId: requestRecord.id, feeType, feeValue: fields.feeValue}, fields.senderUserId, fields.profileId, new Date().toISOString(), 0, new Date(new Date().getTime() + 60000).toISOString())
            }
            // return creatred record
            return {
                transferType: transferType.CRYPTO_TO_CRYPTO,
                transferDetails: {
                    id: requestRecord.id,
                    requestId: fields.requestId,
                    senderUserId: fields.senderUserId,
                    recipientUserId: fields.recipientUserId || null,
                    recipientAddress: fields.recipientAddress,
                    chain: fields.chain,
                    currency: fields.currency,
                    amount: fields.amount,
                    transactionHash: null,
                    createdAt: requestRecord.created_at,
                    updatedAt: requestRecord.updatedAt,
                    status: requestRecord.status,
                    contractAddress: requestRecord.contract_address,
                    failedReason: null,
                    fee: {
                        feeId: feeRecord.id,
                        feeType,
                        feeAmount,
                        feePercent,
                        status: "CREATED",
                        transactionHash: null,
                        failedReason: null,
                    },
                }
            }
        }else{
            // perfrom transfer with fee
            const receipt = await CryptoToCryptoWithFeeBastion(requestRecord, feeRecord, paymentProcessorContractAddress, feeType, feePercent, feeAmount, fields.profileId, fields)
            // gas check
            await bastionGasCheck(requestRecord.bastion_user_id, fields.chain)
            // allowance check
            await allowanceCheck(requestRecord.bastion_user_id, fields.senderAddress, fields.chain, fields.currency)
            return receipt
        }

    }else{
        // transfer without fee
        const bodyObject = {
            requestId: requestRecord.bastion_request_id,
            userId: requestRecord.bastion_user_id,
            contractAddress: requestRecord.contract_address,
            actionName: "transfer",
            chain: requestRecord.chain,
            actionParams: erc20Transfer(requestRecord.currency, requestRecord.recipient_address, unitsAmount)
        };

        const response = await submitUserAction(bodyObject)
        const responseBody = await response.json()

        let record
        if (!response.ok) {

            await createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
            const {message, type} = getMappedError(responseBody.message)

             // update to database
            const toUpdate = {
                bastion_response: responseBody,
                status: "FAILED",
                failed_reason: message
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
        await bastionGasCheck(requestRecord.bastion_user_id, fields.chain)
    
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

const bastionCryptoTransferDeveloperWithdraw = async(fields) => {
    if (!isValidAmount(fields.amount, 0.01)) throw new CreateCryptoToCryptoTransferError(CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR, "Transfer amount must be greater than or equal to 0.01.")
    // convert to actual crypto amount
    const decimal = currencyDecimal[fields.currency]
    const unitsAmount = toUnitsString(fields.amount, decimal) 
    fields.unitsAmount = unitsAmount
    const contractAddress = currencyContractAddress[fields.chain][fields.currency]
    fields.contractAddress = contractAddress
    fields.provider = "BASTION"
 
    requestRecord = await insertRequestRecord(fields)

    // transfer without fee
    let record
    // swap user id 
    const fieldsForDeveloperUser = {...fields, senderUserId: `${fields.senderUserId}-${fields.walletType}`}
    const response = await bastionTransfer(requestRecord.bastion_request_id, fieldsForDeveloperUser)
    const responseBody = await response.json()
    if (!response.ok) {

        await createLog("transfer/util/transfer", fields.senderUserId, responseBody.message, responseBody)
        const {message, type} = getMappedError(responseBody.message)

            // update to database
        const toUpdate = {
            bastion_response: responseBody,
            status: "FAILED",
            failed_reason: message
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
    await bastionGasCheck(fieldsForDeveloperUser.senderUserId, fields.chain)

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
            failedReason: record.failed_reason,
            walletType: fields.walletType
        }
    }

    return receipt
}


module.exports = {
    bastionCryptoTransfer,
    CreateCryptoToCryptoTransferError,
    CreateCryptoToCryptoTransferErrorType,
    bastionCryptoTransferDeveloperWithdraw
}