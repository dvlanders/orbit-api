const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const transferBaseAsset = require("../../../bastion/endpoints/transferBaseAsset")
const { insertSingleBastionTransactionRecord, updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService")
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap")
const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { currencySymbolMap } = require("../../../bastion/utils/utils")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { safeParseBody } = require("../../../utils/response")
const { statusMapBastion } = require("./statusMap")

const transferToAddressBastionBaseAsset = async(config) => {
    const {senderBastionUserId, currency, amountInEther, chain, destinationAddress, transferType, providerRecordId} = config
    const currencyContract = currencyContractAddress[chain][currency]
    
    // insert record in provider table
    const providerRecord = await getBastionTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id
    const currencySymbol = currencySymbolMap[chain]

    // create request
    const response = await transferBaseAsset(requestId, senderBastionUserId, chain, currencySymbol, amountInEther, destinationAddress)
    const responseBody = await safeParseBody(response)

    // update record in provider table
    const toUpdate = {
        bastion_response: responseBody,
        updated_at: new Date().toISOString(),
        bastion_user_id: senderBastionUserId,
    }

    let failedReason
    if (response.ok){
        toUpdate.bastion_status = responseBody.status
    }else{
        toUpdate.bastion_status = "NOT_INITIATED"
        const {message, type} = getMappedError(responseBody.message)
        failedReason = message
    }

    await updateBastionTransactionRecord(providerRecord.id, toUpdate)

    const statusMapping = statusMapBastion[transferType]
    const mainTableStatus = statusMapping[toUpdate.bastion_status]

    return {providerRecordId: providerRecord.id, response, responseBody, mainTableStatus, providerStatus: toUpdate.bastion_status, failedReason}

} 

module.exports = {
    transferToAddressBastionBaseAsset
}