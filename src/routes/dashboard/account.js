const { account } = require("../../controllers");
const { authorizeDashboard, logRequestResponse, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");


module.exports = (router) => {
	router.post("/dashboard/account/usd/offramp", authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse, account.createUsdOfframpDestination); // bridge external account
	router.post("/dashboard/account/euro/offramp", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, account.createEuroOfframpDestination);// bridge external account
	router.get("/dashboard/account", authorizeDashboard, requiredProdDashboard,logRequestResponse, account.getAccount);
	router.get("/dashboard/account/all", authorizeDashboard, requiredProdDashboard,logRequestResponse, account.getAllAccounts);
	router.post("/dashboard/account/wire/offramp", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, account.createCircleWireBankAccount);
	// router.post("/account/brl/offramp", authorize, logRequestResponse, account.createBlindpayBankAccount);
	// router.post("/account/brl/receiver", authorize, logRequestResponse, account.createBlindpayReceiver);

};