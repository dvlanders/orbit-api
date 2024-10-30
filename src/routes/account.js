const { account } = require("../controllers");

const { authorize, logRequestResponse, updateLastUserActivity } = require("../util/middleware");

module.exports = (router) => {
	router.post("/account/usd/onramp/plaid", authorize, logRequestResponse, updateLastUserActivity, account.createUsdOnrampSourceWithPlaid); // checkbook
	router.post("/account/usd/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createUsdOfframpDestination); // bridge external account
	router.post("/account/activateOnRampRail", authorize, logRequestResponse, updateLastUserActivity, account.activateOnRampRail)
	router.post("/account/euro/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createEuroOfframpDestination);// bridge external account
	router.get("/account", authorize, logRequestResponse, account.getAccount);
	router.get("/account/all", authorize, logRequestResponse, account.getAllAccounts);
	router.post("/account/wire/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createCircleWireBankAccount);
	router.post("/account/wire/us/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createWireUsOfframpDestination);
    router.post("/account/swift/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createSwiftOfframpDestination)
	router.get("/account/onRampRail/virtualAccount", authorize, logRequestResponse, account.getVirtualAccount)
	router.post("/account/south-america/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createBlindpayBankAccount);
	router.post("/account/south-america/receiver", authorize, logRequestResponse, updateLastUserActivity, account.createBlindpayReceiver);
	router.post("/account/apac/offramp", authorize, logRequestResponse, updateLastUserActivity, account.createAPACOfframpDestination);
	router.get("/account/south-america/receiver", authorize, logRequestResponse, account.getBlindpayReceiver);
	router.put("/account/south-america/receiver", authorize, logRequestResponse, updateLastUserActivity, account.updateBlindpayReceiver);
};
