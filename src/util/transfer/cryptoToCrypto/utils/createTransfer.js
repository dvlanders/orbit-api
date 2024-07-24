const requiredFields = [
    "senderUserId", "amount", "requestId", "chain", "currency"
]

const acceptedFields = {
    "senderUserId": "string",
    "profileId": "string",
    "amount": ["number", "string"],
    "requestId": "string",
    "recipientUserId": "string",
    "recipientAddress": "string",
    "chain": "string",
    "currency": "string",
    "feeType": "string",
    "feeValue": ["number", "string"]
};

const CreateCryptoToCryptoTransferErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	CLIENT_ERROR: "CLIENT_ERROR"
};

class CreateCryptoToCryptoTransferError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, CreateCryptoToCryptoTransferError.prototype);
	}
}

const supportedCurrency = new Set(["usdc"])

module.exports = {
    requiredFields,
    acceptedFields,
    supportedCurrency,
    CreateCryptoToCryptoTransferErrorType,
    CreateCryptoToCryptoTransferError
}