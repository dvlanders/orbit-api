
const CreateCryptoToBankTransferErrorType = {
	INTERNAL_ERROR: "INTERNAL_ERROR",
	CLIENT_ERROR: "CLIENT_ERROR"
};

class CreateCryptoToBankTransferError extends Error {
	constructor(type, message, rawResponse) {
		super(message);
		this.type = type;
		this.rawResponse = rawResponse;
		Object.setPrototypeOf(this, CreateCryptoToBankTransferError.prototype);
	}
}


module.exports = {
    CreateCryptoToBankTransferError,
    CreateCryptoToBankTransferErrorType
}