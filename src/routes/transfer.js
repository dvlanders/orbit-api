const { transfer } = require("../controllers");

const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto-to-fiat", transfer.transferUsdcFromWalletToBankAccount);

};
