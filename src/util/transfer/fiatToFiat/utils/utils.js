const CreateFiatToFiatTransferErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	CLIENT_ERROR: "CLIENT_ERROR"
};

class CreateFiatToFiatTransferError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, CreateFiatToFiatTransferError.prototype);
	}
}


module.exports = {
    CreateFiatToFiatTransferError,
    CreateFiatToFiatTransferErrorType
}