

// Bastion API error mappings
const errorMappings = {
    "execution reverted: ERC20: transfer amount exceeds balance": {
      message: "Transfer amount exceeds balance.",
      type: "CLIENT_ERROR"
    },
    "gas required exceeds allowance (7717)":{
      message: "Not enough gas, please contact HIFI for more information",
      type: "INTERNAL_ERROR"
    },

};

const getMappedError = (externalErrorMessage) => {
    return errorMappings[externalErrorMessage] || {message: "Please contact HIFI for more information", type: CreateCryptoToCryptoTransferErrorType.INTERNAL_ERROR};
  }
  

module.exports = {
  getMappedError
}