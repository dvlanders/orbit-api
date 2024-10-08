const { isUUID } = require("../../../common/fieldsValidation");
const { isValidAmount, inStringEnum, isHIFISupportedChain } = require("../../../common/filedValidationCheckFunctions");
const { allowedWalletTypes } = require("../../utils/walletType");

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
    "currency": (value) => inStringEnum(value, ["usdc", "usdt", "usdHifi"]),
    "feeType": (value) => inStringEnum(value, ["FIX", "PERCENT"]),
    "feeValue": (value) => isValidAmount(value),
    "senderWalletType": (value) => inStringEnum(value, allowedWalletTypes),
    "recipientWalletType": (value) => inStringEnum(value, allowedWalletTypes)
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