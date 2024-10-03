const { isValidMessage } = require("../../../common/filedValidationCheckFunctions");

const validatePaymentRailParams = (paymentRail, sameDayAch) => {
    return paymentRail == "ach" || !sameDayAch
}

const validateBridgeTransferParams = async (config) => {
    const { amount, feeType, feeValue, paymentRail, sameDayAch, wireMessage } = config;
    const validationRes = { invalidFieldsAndMessages: [], valid: true };
    
    // check if wire message is valid
    if (wireMessage && !isValidMessage(wireMessage, 4, 35))
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["wireMessage"],
            errorMessage: "wireMessage should not exceed 4 lines, and each line should not exceed 35 characters.",
        });
        validationRes.valid = false;

    if (!validatePaymentRailParams(paymentRail, sameDayAch)) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["paymentRail", "sameDayAch"],
            errorMessage: "sameDayAch is only available for ACH transfers, but the destinationAccountId passed was not for an ACH account.",
        });
        validationRes.valid = false;
    }
    if (amount < 1) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["amount"],
            errorMessage: "Transfer amount must be greater than or equal to 1.",
        });
        validationRes.valid = false;
    }

    return validationRes;
};

const validateReapTransferParams = async (config) => {
    const { amount, feeType, feeValue, paymentRail, sameDayAch } = config;
    const validationRes = { invalidFieldsAndMessages: [], valid: true };

    if (!validatePaymentRailParams(paymentRail, sameDayAch)) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["paymentRail", "sameDayAch"],
            errorMessage: "sameDayAch is only available for ACH transfers, but the destinationAccountId passed was not for an ACH account.",
        });
        validationRes.valid = false;
    }
    if (amount < 1) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["amount"],
            errorMessage: "Transfer amount must be greater than or equal to 1.",
        });
        validationRes.valid = false;
    }
    if (feeType || feeValue > 0) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["feeType", "feeValue"],
            errorMessage:
                "Fee collection feature is not yet available for this route",
        });
        validationRes.valid = false;
    }

    return validationRes;
};

const validateBlindPayTransferParams = async (config) => {
    const { amount, feeType, feeValue, paymentRail, sameDayAch } = config;
    const validationRes = { invalidFieldsAndMessages: [], valid: true };

    if (!validatePaymentRailParams(paymentRail, sameDayAch)) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["paymentRail", "sameDayAch"],
            errorMessage: "sameDayAch is only available for ACH transfers, but the destinationAccountId passed was not for an ACH account.",
        });
        validationRes.valid = false;
    }
    if (amount < 10 || amount > 1000) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["amount"],
            errorMessage:
                "Transfer amount must be between 10 and 1000.",
        });
        validationRes.valid = false;
    }
    if (feeType || feeValue > 0) {
        validationRes.invalidFieldsAndMessages.push({
            invalidFields: ["feeType", "feeValue"],
            errorMessage:
                "Fee collection feature is not yet available for this route",
        });
        validationRes.valid = false;
    }

    return validationRes;
};

module.exports = {
    validateBridgeTransferParams,
    validateBlindPayTransferParams,
    validateReapTransferParams,
};
