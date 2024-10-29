const { transfer } = require("../../controllers");
const { authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, updateLastUserActivity } = require("../../util/middleware");

module.exports = (router) => {
	router.post("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, requiredProdDashboard, logRequestResponse, updateLastUserActivity, transfer.createCryptoToCryptoTransfer);
	router.post("/dashboard/transfer/crypto-to-crypto/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, updateLastUserActivity, transfer.createCryptoToCryptoTransfer);
	router.get("/dashboard/transfer/crypto-to-crypto", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getCryptoToCryptoTransfer)
	router.get("/dashboard/transfer/crypto-to-crypto/all", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getAllCryptoToCryptoTransfer)
	router.post("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, requiredProdDashboard, logRequestResponse, updateLastUserActivity, transfer.createCryptoToFiatTransfer);
	router.post("/dashboard/transfer/crypto-to-fiat/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, updateLastUserActivity, transfer.createCryptoToFiatTransfer);
	router.get("/dashboard/transfer/crypto-to-fiat", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getCryptoToFiatTransfer);
	router.get("/dashboard/transfer/crypto-to-fiat/all", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getAllCryptoToFiatTransfer);
	router.post("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, requiredProdDashboard, logRequestResponse, updateLastUserActivity, transfer.createFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getFiatToCryptoTransfer)
	router.get("/dashboard/transfer/fiat-to-crypto/all", authorizeDashboard, requiredProdDashboard, logRequestResponse, transfer.getAllFiatToCryptoTransfer)
};
