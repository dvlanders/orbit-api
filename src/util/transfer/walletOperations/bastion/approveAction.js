const { submitUserAction } = require("../../../bastion/endpoints/submitUserAction")
const { updateBastionTransactionRecord, getBastionTransactionRecord } = require("../../../bastion/main/bastionTransactionTableService")
const { erc20Approve } = require("../../../bastion/utils/erc20FunctionMap")
const { currencyContractAddress } = require("../../../common/blockchain")
const { safeParseBody } = require("../../../utils/response")

const approveActionBastion = async(config) => {
    const {senderBastionUserId, spender, unitsAmount, chain, currency, providerRecordId} = config
    const currencyContract = currencyContractAddress[chain][currency]
    
    // insert record in provider table
    const providerRecord = await getBastionTransactionRecord(providerRecordId)
    const requestId = providerRecord.request_id

    const bodyObject = {
		requestId: requestId,
		userId: senderBastionUserId,
		contractAddress: currencyContract,
		actionName: "approve",
		chain: chain,
		actionParams: erc20Approve(currency, spender, unitsAmount)
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

    return {response, responseBody}

} 

module.exports = {
    approveActionBastion
}