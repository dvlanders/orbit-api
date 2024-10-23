const { v4 } = require("uuid");
const { getBridgeTransactionRecord, updateBridgeTransactionRecord } = require("../bridgeTransactionTableService");
const { safeParseBody } = require("../../utils/response");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeTransfer = async (clientReferenceId, amount, onBehalfOfBridgeUserId, source, destination, bridgeTransactionRecordId) => {
	// get bridge transaction record
	const bridgeTransactionRecord = await getBridgeTransactionRecord(bridgeTransactionRecordId)
	const requestId = bridgeTransactionRecord.request_id

	// create a bridge transfer
	const requestBody = {
		client_reference_id: clientReferenceId,
		amount: amount,
		on_behalf_of: onBehalfOfBridgeUserId,
		source,
		destination
	}


	const url = `${BRIDGE_URL}/v0/transfers`
	const options = {
		method: 'POST',
		headers: {
			'Idempotency-Key': requestId,
			'Api-Key': BRIDGE_API_KEY,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	}
	const response = await fetch(url, options);
	const responseBody = await safeParseBody(response)
	// update bridge transaction record
	const toUpdate = {
		updated_at: new Date().toISOString(),
		bridge_status: responseBody.state,
		bridge_response: responseBody,
		bridge_transfer_id: responseBody.id,
		bridge_user_id: onBehalfOfBridgeUserId
	}

	await updateBridgeTransactionRecord(bridgeTransactionRecordId, toUpdate)
	let failedReason
	if (!response.ok){
		failedReason = "Please contact HIFI for more information"
	}

	return {response, responseBody, failedReason, providerStatus: responseBody.state}


}

module.exports = createBridgeTransfer