const ReceiverInfoUploadErrorType = {
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_FIELD: "INVALID_FIELD",
  FIELD_MISSING: "FIELD_MISSING",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
};

class ReceiverInfoUploadError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.rawResponse = rawResponse;
    this.status = status;
    Object.setPrototypeOf(this, ReceiverInfoUploadError.prototype);
  }
}

const CreateReceiverErrorType = {
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  INVALID_FIELD: "INVALID_FIELD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

class CreateReceiverError extends Error {
  constructor(type, message, rawResponse) {
    super(message);
    this.type = type;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, CreateReceiverError.prototype);
  }
}

const BankAccountInfoUploadErrorType = {
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_FIELD: "INVALID_FIELD",
  FIELD_MISSING: "FIELD_MISSING",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
};

class BankAccountInfoUploadError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.rawResponse = rawResponse;
    this.status = status;
    Object.setPrototypeOf(this, BankAccountInfoUploadError.prototype);
  }
}

const CreateBankAccountErrorType = {
  KYC_TYPE_NOT_SUPPORTED: "KYC_TYPE_NOT_SUPPORTED",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  INVALID_FIELD: "INVALID_FIELD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

class CreateBankAccountError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.status = status;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, CreateBankAccountError.prototype);
  }
}

const ReceiverInfoGetErrorType = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
};

class ReceiverInfoGetError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.rawResponse = rawResponse;
    this.status = status;
    Object.setPrototypeOf(this, ReceiverInfoGetError.prototype);
  }
}

const CreateQuoteErrorType = {
  INVALID_FIELD: "INVALID_FIELD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

class CreateQuoteError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.status = status;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, CreateQuoteError.prototype);
  }
}

const ExecutePayoutErrorType = {
  INVALID_FIELD: "INVALID_FIELD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

class ExecutePayoutError extends Error {
  constructor(type, status, message, rawResponse) {
    super(message);
    this.type = type;
    this.status = status;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, ExecutePayoutError.prototype);
  }
}

module.exports = {
  ReceiverInfoUploadErrorType,
  ReceiverInfoUploadError,
  CreateReceiverErrorType,
  CreateReceiverError,
  BankAccountInfoUploadErrorType,
  BankAccountInfoUploadError,
  CreateBankAccountErrorType,
  CreateBankAccountError,
  ReceiverInfoGetErrorType,
  ReceiverInfoGetError,
  CreateQuoteErrorType,
  CreateQuoteError,
  ExecutePayoutErrorType,
  ExecutePayoutError
};
