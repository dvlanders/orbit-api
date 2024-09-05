const { isUUID } = require("../../../common/fieldsValidation");
const { isValidAmount, inStringEnum, isHIFISupportedChain } = require("../../../common/filedValidationCheckFunctions");

const requiredFields = [
    "senderUserId", "amount", "requestId", "chain", "currency"
]

const acceptedFields = {
    "senderUserId": (value) => isUUID(value),
    "amount": (value) => isValidAmount(value),
    "requestId": (value) => isUUID(value),
    "recipientUserId": (value) => isUUID(value),
    "recipientAddress": "string",
    "chain": (value) => isHIFISupportedChain(value),
    "currency": "string",
    "feeType": (value) => inStringEnum(value, ["FIX", "PERCENT"]),
    "feeValue": (value) => isValidAmount(value),
    "senderWalletType": (value) => inStringEnum(value, ["INDIVIDUAL", "FEE_COLLECTION", "PREFUNDED"]),
    "recipientWalletType": (value) => inStringEnum(value, ["INDIVIDUAL", "FEE_COLLECTION", "PREFUNDED"])
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