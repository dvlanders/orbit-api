const { transfer } = require("../controllers")

module.exports = (router) => {
    router.post("/transfer/crypto_to_crypto", transfer.createCryptoToCryptoTransfer);
    router.get("/transfer/crypto_to_crypto", transfer.getCryptoToCryptoTransfer)
	router.post("/transfer/crypto-to-fiat", transfer.transferUsdcFromWalletToBankAccount);
};
