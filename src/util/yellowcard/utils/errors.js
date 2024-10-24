const YcAccountInfoErrorType = {
    INTERNAL_ERROR: "INTERNAL_ERROR",
    INVALID_FIELD: "INVALID_FIELD",
    FIELD_MISSING: "FIELD_MISSING",
    RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
};
  
class YcAccountInfoError extends Error {
    constructor(type, status, message, rawResponse) {
        super(message);
        this.type = type;
        this.rawResponse = rawResponse;
        this.status = status;
        Object.setPrototypeOf(this, YcAccountInfoError.prototype);
    }
}

module.exports = {
    YcAccountInfoErrorType,
    YcAccountInfoError,
}