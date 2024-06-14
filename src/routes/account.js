const { account } = require("../controllers");

const { authorize } = require("../util/middleware");

module.exports = (router) => {
	router.post("/account/usd/onramp/plaid", account.createUsdOnrampSourceWithPlaid); // checkbook
	router.post("/account/usd/offramp", account.createUsdOfframpDestination); // bridge external account

	// router.post("/account/euro/onramp", account.createBankAccount); // not possible currently
	router.post("/account/euro/offramp", account.createEuroOfframpDestination);// bridge external account
	router.get("/account", account.getAccount);// bridge external account

};
