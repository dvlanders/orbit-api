const { transfer } = require("../controllers");
const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto_to_crypto", transfer.createCryptoToCryptoTransfer);
	router.get("/transfer/crypto_to_crypto", transfer.getCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-usd", transfer.transferUsdcFromWalletToBankAccount);
	router.post("/transfer/crypto-to-euro", transfer.transferUsdcFromWalletToBankAccount);

};
