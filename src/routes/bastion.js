const { bastion } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/bastion/v1/users/create", bastion.createUser);
	router.get("/bastion/v1/users/", authorizeUser, bastion.getUser);
	router.get("/bastion/v1/userAction/", authorizeUser, bastion.getUserAction);
	router.post("/bastion/transferUsdc/", authorizeUser, bastion.transferUsdc);
	router.post("/bastion/submitKyc/", authorizeUser, bastion.submitKyc);
	router.post("/bastion/initiateUsdcWithdrawal/", authorizeUser, bastion.initiateUsdcWithdrawal);
	router.post("/bastion/notify/userAction/update", bastion.updateOnchainTransactionStatus);
	router.post("/bastion/getAndUpdateTransactionStatus", authorizeUser, bastion.getAndUpdateOnchainTransactionStatus);
	router.get("/get_ping/", bastion.getPing);
};