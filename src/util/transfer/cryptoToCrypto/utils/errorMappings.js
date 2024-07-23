const { CreateCryptoToCryptoTransferErrorType } = require("./createTransfer")

// Bastion API error mappings
const errorMappings = {
    "execution reverted: ERC20: transfer amount exceeds balance": {
      message: "Transfer amount exceeds balance.",
      type: CreateCryptoToCryptoTransferErrorType.CLIENT_ERROR
    },
};

const getMappedError = (externalErrorMessage) => {
    return errorMappings[externalErrorMessage] || {message: "Not enough gas, please contact HIFI for more information", type: CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR};
  }
  

module.exports = {
  getMappedError
}