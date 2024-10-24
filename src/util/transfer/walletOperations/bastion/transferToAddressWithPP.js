const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const { insertSingleBastionTransactionRecord, updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService")
const { erc20Transfer } = require("../../../bastion/utils/erc20FunctionMap")
const { getMappedError } = require("../../../bastion/utils/errorMappings")
const { currencyDecimal, currencyContractAddress } = require("../../../common/blockchain")
const { safeParseBody } = require("../../../utils/response")
const { statusMapBastion } = require("./statusMap")

// transfer with payment processor
const transferToAddressBastionWithPP = async(config) => {
    const {senderBastionUserId, currency, unitsAmount, chain, destinationAddress, transferType, paymentProcessorContract, feeUnitsAmount, feeCollectionWalletAddress, providerRecordId, paymentProcessType} = config
    const tokenContractAddress = currencyContractAddress[chain][currency]

    // get provider record
    const providerRecord = await getBastionTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id
    const actionName = paymentProcessType == "EXACT_IN" ? "processPaymentExactIn" : "processPaymentExactOut"

    const bodyObject = {
        requestId: requestId,
        userId: senderBastionUserId,
        contractAddress: paymentProcessorContract,
        actionName: actionName,
        chain,
        actionParams: [
            {name: "token", value: tokenContractAddress},
            {name: "to", value: destinationAddress},
            {name: "feeWallet", value: feeCollectionWalletAddress},
            {name: "amount", value: unitsAmount},
            {name: "fee", value: feeUnitsAmount},
        ]
    };

    const response = await submitUserAction(bodyObject)
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

    const mainStatusMapping = statusMapBastion[transferType]
    const feeRecordStatusMapping = statusMapBastion.FEE
    const mainTableStatus = mainStatusMapping[toUpdate.bastion_status]
    const feeRecordStatus = feeRecordStatusMapping[toUpdate.bastion_status]

    return {providerRecordId: providerRecord.id, response, responseBody, mainTableStatus, providerStatus: toUpdate.bastion_status, failedReason, feeRecordStatus}

} 

module.exports = {
    transferToAddressBastionWithPP
}