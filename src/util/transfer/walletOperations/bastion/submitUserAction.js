const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const { updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService")
const { safeParseBody } = require("../../../utils/response")

const submitBastionUserAction = async(config) => {
    const {senderBastionUserId, senderUserId, contractAddress, actionName, chain, actionParams, transferType, providerRecordId} = config;   

    const providerRecord = await getBastionTransactionRecord(providerRecordId);
    const requestId = providerRecord.request_id;

    const bodyObject = {
        requestId: requestId,
        userId: senderUserId,
        contractAddress, 
        actionName,
        chain,
        actionParams
    };

    const response = await submitUserAction(bodyObject)
    const responseBody = await safeParseBody(response)

    // update record in provider table
    const toUpdate = {
        bastion_response: responseBody,
        bastion_user_id: senderBastionUserId,
    }

    if (response.ok){
        toUpdate.bastion_status = responseBody.status
    }else{
        toUpdate.bastion_status = "NOT_INITIATED"
    }

    await updateBastionTransactionRecord(providerRecord.id, toUpdate)
    return {response, responseBody};

} 

module.exports = {
    submitBastionUserAction
}