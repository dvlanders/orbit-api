const { account } = require("../controllers");

const { authorize, authorizeSupabase } = require("../util/middleware");

module.exports = (router) => {
	router.post("/account/usd/onramp/plaid", authorize, account.createUsdOnrampSourceWithPlaid); // checkbook
	router.post("/account/usd/offramp", authorize, account.createUsdOfframpDestination); // bridge external account
	router.post("/account/activateOnRampRail", authorize, account.activateOnRampRail)
	// router.post("/account/euro/onramp", account.createBankAccount); // not possible currently
	router.post("/account/euro/offramp", authorize, account.createEuroOfframpDestination);// bridge external account
	router.get("/account", authorize, account.getAccount);// bridge external account
};
