const { submitUserAction } = require("../../bastion/endpoints/submitUserAction");
const { insertSingleBastionTransactionRecord, updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../bastion/main/bastionTransactionTableService");
const { getMappedError } = require("../../bastion/utils/errorMappings");
const { statusMapBastion } = require("../../transfer/walletOperations/bastion/statusMap");
const { safeParseBody } = require("../../utils/response");
const { USDHIFIContractAddressMap } = require("./utils");


const gasStation = '4fb4ef7b-5576-431b-8d88-ad0b962be1df'


const transferUSDHIFI = async (config) => {
    const {fromWalletAddress, currency, unitsAmount, chain, userId, toWalletAddress, transferType, providerRecordId} = config
    const contractAddress = USDHIFIContractAddressMap[chain];

    // get provider record
    const providerRecord = await getBastionTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    //  function call to Bastion
    const bodyObject = {
        requestId: requestId,
        userId: gasStation,
        contractAddress: contractAddress,
        actionName: "ownerTransferOnBehalfUser",
        chain: chain,
        actionParams: [
            { name: "onBehalf", value: fromWalletAddress },
            { name: "to", value: toWalletAddress },
            { name: "amount", value: unitsAmount }
        ]
    };

    const response = await submitUserAction(bodyObject)
    const responseBody = await safeParseBody(response)

    // update record in provider table
    const toUpdate = {
        bastion_response: responseBody,
        updated_at: new Date().toISOString()
    }

    let failedReason
    if (response.ok){
        toUpdate.bastion_status = responseBody.status
    }else{
        toUpdate.bastion_status = "NOT_INITIATED"
        const {message, type} = getMappedError(responseBody.message)
        failedReason = "Transfer amount exceeds balance."
    }

    await updateBastionTransactionRecord(providerRecord.id, toUpdate)

    const statusMapping = statusMapBastion[transferType]
    const mainTableStatus = statusMapping[toUpdate.bastion_status]

    return {providerRecordId: providerRecord.id, response, responseBody, mainTableStatus, providerStatus: toUpdate.bastion_status, failedReason}
}  

module.exports = {
    transferUSDHIFI
}
