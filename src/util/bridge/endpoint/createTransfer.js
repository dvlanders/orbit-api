const { v4 } = require("uuid");

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_URL = process.env.BRIDGE_URL;

const createBridgeTransfer = async (client_reference_id, amount, on_behalf_of, source, destination) => {
	// create a bridge transfer
	const requestBody = {
		client_reference_id,
		amount: amount,
		on_behalf_of,
		source,
		destination
	}


	const url = `${BRIDGE_URL}/v0/transfers`
	const options = {
		method: 'POST',
		headers: {
			'Idempotency-Key': v4(),
			'Api-Key': BRIDGE_API_KEY,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	}
	const response = await fetch(url, options);
	return response
}

module.exports = createBridgeTransfer