const { transfer } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/transfer/crypto-to-fiat", transfer.transferUsdcFromWalletToBankAccount);

};
