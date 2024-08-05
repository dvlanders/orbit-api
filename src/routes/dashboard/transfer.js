const { transfer } = require("../../controllers");
const { authorize, authorizeDashboard, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");

module.exports = (router) => {
	router.post("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, requiredProdDashboard, transfer.createCryptoToCryptoTransfer);
	router.post("/dashboard/transfer/crypto-to-crypto/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, transfer.createCryptoToCryptoWithdrawForDeveloperUser);
	router.get("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, requiredProdDashboard,transfer.getCryptoToCryptoTransfer)
	router.get("/dashboard/transfer/crypto-to-crypto/all", authorizeDashboard, requiredProdDashboard,transfer.getAllCryptoToCryptoTransfer)
	router.post("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, requiredProdDashboard,transfer.transferCryptoFromWalletToBankAccount);
	router.post("/dashboard/transfer/crypto-to-fiat/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, transfer.createCryptoToFiatWithdrawForDeveloperUser);
	router.get("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, requiredProdDashboard,transfer.getCryptoToFiatTransfer);
	router.get("/dashboard/transfer/crypto-to-fiat/all", authorizeDashboard, requiredProdDashboard,transfer.getAllCryptoToFiatTransfer);
	router.post("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, requiredProdDashboard,transfer.createFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, requiredProdDashboard,transfer.getFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto/all", authorizeDashboard, requiredProdDashboard,transfer.getAllFiatToCryptoTransfer)
};
