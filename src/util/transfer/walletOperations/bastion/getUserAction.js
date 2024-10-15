const { getUserActions } = require('../../../bastion/endpoints/getUserAction');
const { safeParseBody } = require("../../../utils/response")

const getUserAction = async (config) => {
    const {requestId, bastionUserId} = config;
    const response = await getUserActions(requestId, bastionUserId);
    const responseBody = await safeParseBody(response);
    return {response, responseBody};
}

module.exports = {
    getUserAction
}