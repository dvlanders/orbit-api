const {
    CreateCryptoToBankTransferError,
    CreateCryptoToBankTransferErrorType,
} = require("./createTransfer");

const validateBridgeTransferParams = async (config) => {
    const { amount, feeType, feeValue } = config;
    if (amount < 1)
        throw new CreateCryptoToBankTransferError(
            CreateCryptoToBankTransferErrorType.CLIENT_ERROR,
            "Transfer amount must be greater than or equal to 1."
        );
};

const validateReapTransferParams = async (config) => {
    const { amount, feeType, feeValue } = config;
    if (amount < 1)
        throw new CreateCryptoToBankTransferError(
            CreateCryptoToBankTransferErrorType.CLIENT_ERROR,
            "Transfer amount must be greater than or equal to 1."
        );
    if (feeType || feeValue > 0)
        throw new CreateCryptoToBankTransferError(
            CreateCryptoToBankTransferErrorType.CLIENT_ERROR,
            "Fee collection feature is not yet available for this route"
        );
};

const validateBlindPayTransferParams = async (config) => {
    const { amount, feeType, feeValue } = config;
    if (amount < 10)
        throw new CreateCryptoToBankTransferError(
            CreateCryptoToBankTransferErrorType.CLIENT_ERROR,
            "Transfer amount must be greater than or equal to 10."
        );
    if (feeType || feeValue > 0)
        throw new CreateCryptoToBankTransferError(
            CreateCryptoToBankTransferErrorType.CLIENT_ERROR,
            "Fee collection feature is not yet available for this route"
        );
};

module.exports = {
    validateBridgeTransferParams,
    validateBlindPayTransferParams,
    validateReapTransferParams,
};
