const { CreateCryptoToBankTransferErrorType } = require("../../../util/transfer/cryptoToBankAccount/utils/createTransfer");

// Bastion API error mappings
const errorMappings = {
    "execution reverted: ERC20: transfer amount exceeds balance": {
      message: "Transfer amount exceeds balance.",
      type: "CLIENT_ERROR"
    },
    "insufficient gas for transaction":{
      message: "Not enough gas, please contact HIFI for more information",
      type: "INTERNAL_ERROR"
    },
    "execution reverted: Balance is not enough for transaction": {
      message: "Transfer amount exceeds balance.",
      type: "CLIENT_ERROR"
    }

};

const getMappedError = (externalErrorMessage) => {
    return errorMappings[externalErrorMessage] || {message: "Please contact HIFI for more information", type: CreateCryptoToBankTransferErrorType.INTERNAL_ERROR};
}
  

module.exports = {
  getMappedError
}