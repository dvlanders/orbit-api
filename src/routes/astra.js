const { astra } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	// router.post("/bastion/v1/users/create", bastion.createUser);
	// router.get("/bastion/v1/users/", bastion.getUser);

	// router.get("/bastion/v1/userAction/", bastion.getUserAction);
	// router.post("/bastion/transferUsdc/", bastion.transferUsdc);
	// router.post("/bastion/submitKyc/", bastion.submitKyc);
	// router.post("/bastion/initiateUsdcWithdrawal/", bastion.initiateUsdcWithdrawal);
	// router.post("/bastion/notify/userAction/update", bastion.updateOnchainTransactionStatus);
	router.post("/astra/oauth/token", astra.exchangeAuthCodeForAccessToken);
	router.post("/astra/accounts/processor_token", astra.createAccountByPlaidProcessorToken);
	router.post("/astra/accounts/create", astra.createAccountByRoutingAccountNumber);

};
