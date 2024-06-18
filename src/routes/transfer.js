const { transfer } = require("../controllers");
const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto_to_crypto", authorize, transfer.createCryptoToCryptoTransfer);
	router.get("/transfer/crypto_to_crypto", authorize, transfer.getCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-usd", authorize, transfer.transferUsdcFromWalletToBankAccount);
	router.post("/transfer/crypto-to-euro", authorize, transfer.transferUsdcFromWalletToBankAccount);

};
