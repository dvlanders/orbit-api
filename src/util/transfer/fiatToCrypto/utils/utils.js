const CreateFiatToCryptoTransferErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	CLIENT_ERROR: "CLIENT_ERROR"
};

class CreateFiatToCryptoTransferError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, CreateFiatToCryptoTransferError.prototype);
	}
}


module.exports = {
    CreateFiatToCryptoTransferError,
    CreateFiatToCryptoTransferErrorType
}