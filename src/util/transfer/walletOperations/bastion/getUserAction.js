const { getUserActions } = require('../../../bastion/endpoints/getUserAction');
const { updateBastionTransactionRecord } = require('../../../bastion/main/bastionTransactionTableService');
const { safeParseBody } = require("../../../utils/response")

const getUserAction = async (config) => {
    const {requestId, bastionUserId, providerRecordId} = config;
    const response = await getUserActions(requestId, bastionUserId);
    const responseBody = await safeParseBody(response);

    const toUpdate = {
        bastion_response: responseBody,
    }

    if (response.ok){
        toUpdate.bastion_status = responseBody.status
    }else{
        toUpdate.bastion_status = "NOT_INITIATED"
    }

    await updateBastionTransactionRecord(providerRecordId, toUpdate);
    return {response, responseBody};

}

module.exports = {
    getUserAction
}