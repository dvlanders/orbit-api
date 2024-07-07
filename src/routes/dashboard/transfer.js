const { transfer } = require("../../controllers");
const { authorize, authorizeDashboard } = require("../../util/middleware");

module.exports = (router) => {
	router.post("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, transfer.createCryptoToCryptoTransfer);
	router.get("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, transfer.getCryptoToCryptoTransfer)
	router.get("/dashboard/transfer/crypto-to-crypto/all", authorizeDashboard, transfer.getAllCryptoToCryptoTransfer)
	router.post("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, transfer.transferCryptoFromWalletToBankAccount);
	router.get("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, transfer.getCryptoToFiatTransfer);
	router.get("/dashboard/transfer/crypto-to-fiat/all", authorizeDashboard, transfer.getAllCryptoToFiatTransfer);
	router.post("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, transfer.createFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, transfer.getFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto/all", authorizeDashboard, transfer.getAllFiatToCryptoTransfer)
};
