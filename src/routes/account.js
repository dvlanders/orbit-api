const { account } = require("../controllers");

const { authorize, logRequestResponse } = require("../util/middleware");

module.exports = (router) => {
	router.post("/account/usd/onramp/plaid", authorize, logRequestResponse, account.createUsdOnrampSourceWithPlaid); // checkbook
	router.post("/account/usd/offramp", authorize, logRequestResponse, account.createUsdOfframpDestination); // bridge external account
	router.post("/account/activateOnRampRail", authorize, logRequestResponse, account.activateOnRampRail)
	router.post("/account/euro/offramp", authorize, logRequestResponse, account.createEuroOfframpDestination);// bridge external account
	router.get("/account", authorize, logRequestResponse, account.getAccount);
	router.get("/account/all", authorize, logRequestResponse, account.getAllAccounts);
	router.post("/account/wire/offramp", authorize, logRequestResponse, account.createCircleWireBankAccount);
	router.get("/account/onRampRail/virtualAccount", authorize, logRequestResponse, account.getVirtualAccount)
};
