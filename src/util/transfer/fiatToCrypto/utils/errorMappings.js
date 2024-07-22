const { CreateFiatToCryptoTransferErrorType } = require("./utils")

// Checkbook API error mappings
const errorMappings = {
    "Sending limit exceeded": {
      message: "Exceed transfer amount limit.",
      type: CreateFiatToCryptoTransferErrorType.CLIENT_ERROR
    },
};
  
const getMappedError = (externalErrorMessage) => {
    return errorMappings[externalErrorMessage] || {message: "Unexpected error happened", type: CreateFiatToCryptoTransferErrorType.INTERNAL_ERROR};
  }
  

module.exports = {
  getMappedError
}