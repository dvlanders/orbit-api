const { transfer } = require("../controllers");
const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto-to-crypto", authorize, transfer.createCryptoToCryptoTransfer);
	router.get("/transfer/crypto-to-crypto", authorize, transfer.getCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-fiat", authorize, transfer.transferCryptoFromWalletToBankAccount);
	router.get("/transfer/crypto-to-fiat", authorize, transfer.getCryptoToFiatTransfer);
	router.post("/transfer/fiat-to-crypto", authorize, transfer.createFiatToCryptoTransfer)
	router.get("/transfer/fiat-to-crypto", authorize, transfer.getFiatToCryptoTransfer)
};
