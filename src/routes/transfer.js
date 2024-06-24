const { transfer } = require("../controllers");
const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto-to-crypto", authorize, transfer.createCryptoToCryptoTransfer);
	router.get("/transfer/crypto_to_crypto", authorize, transfer.getCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-fiat", authorize, transfer.transferCryptoFromWalletToBankAccount);

};
