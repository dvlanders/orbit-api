const { fetchWithLogging } = require('../../logger/fetchLogger');

const CHECKBOOK_URL = process.env.CHECKBOOK_URL;

const ExecuteCheckbookDirectPaymentErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR"
};

class ExecuteCheckbookDirectPaymentError extends Error {
	constructor(type, status, message, rawResponse) {
		super(message);
		this.type = type;
		this.status = status;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, ExecuteCheckbookDirectPaymentError.prototype);
	}
}

const executeCheckbookDirectPayment = async (recipient, accountType, routingNumber, accountNumber, name, amount, account, description, apiKey, apiSecret) => {

	const url = `${CHECKBOOK_URL}/check/direct`;
	const body = {
		"recipient": recipient,
		"account_type": accountType,
		"routing_number": routingNumber,
		"account_number": accountNumber,
		"name": name,
		"amount": amount,
		"account": account,
		"description": description
	}

	const options = {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Authorization': `${apiKey}:${apiSecret}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	};

	const response = await fetchWithLogging(url, options);
	const responseBody = await response.json();
	return {response, responseBody};
}

module.exports = {
	executeCheckbookDirectPayment
}