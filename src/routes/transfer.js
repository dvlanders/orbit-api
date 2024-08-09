const { transfer } = require("../controllers");
const { authorize, logRequestResponse } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto-to-crypto", authorize, logRequestResponse, transfer.createCryptoToCryptoTransfer);
	router.get("/transfer/crypto-to-crypto", authorize, logRequestResponse, transfer.getCryptoToCryptoTransfer)
	router.get("/transfer/crypto-to-crypto/all", authorize, logRequestResponse, transfer.getAllCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-fiat", authorize, logRequestResponse, transfer.transferCryptoFromWalletToBankAccount);
	router.get("/transfer/crypto-to-fiat", authorize, logRequestResponse, transfer.getCryptoToFiatTransfer);
	router.get("/transfer/crypto-to-fiat/all", authorize, logRequestResponse, transfer.getAllCryptoToFiatTransfer);
	router.post("/transfer/fiat-to-crypto", authorize, logRequestResponse, transfer.createFiatToCryptoTransfer)
	router.get("/transfer/fiat-to-crypto", authorize, logRequestResponse, transfer.getFiatToCryptoTransfer)
	router.get("/transfer/fiat-to-crypto/all", authorize, logRequestResponse, transfer.getAllFiatToCryptoTransfer)
	router.get("/transfer/fiat-to-crypto/all", authorize, logRequestResponse, transfer.getAllFiatToCryptoTransfer)
	router.get("/transfer/conversionRate/crypto-to-fiat", authorize, logRequestResponse, transfer.cryptoToFiatConversionRate)
	router.post("/v2/transfer/crypto-to-fiat", authorize, logRequestResponse, transfer.createCryptoToFiatTransferV2);
};
