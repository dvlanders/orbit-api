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
	router.post("/account/wire/us/offramp", authorize, logRequestResponse, account.createWireUsOfframpDestination);
	router.post("/account/swift/offramp", authorize, logRequestResponse, account.createSwiftOfframpDestination)
	router.get("/account/onRampRail/virtualAccount", authorize, logRequestResponse, account.getVirtualAccount)
	router.post("/account/south-america/offramp", authorize, logRequestResponse, account.createBlindpayBankAccount);
	router.post("/account/south-america/receiver", authorize, logRequestResponse, account.createBlindpayReceiver);
	router.post("/account/apac/offramp", authorize, logRequestResponse, account.createAPACOfframpDestination);
	router.get("/account/south-america/receiver", authorize, logRequestResponse, account.getBlindpayReceiver);
	router.put("/account/south-america/receiver", authorize, logRequestResponse, account.updateBlindpayReceiver);
	router.post("/account/kes/momo/offramp", authorize, logRequestResponse, account.createKesMomoAccount);
	router.post("/account/mwk/momo/offramp", authorize, logRequestResponse, account.createMwkMomoAccount);
    router.post("/account/xof/momo/offramp", authorize, logRequestResponse, account.createXofMomoAccount);
    router.post("/account/rwf/momo/offramp", authorize, logRequestResponse, account.createRwfMomoAccount);
    router.post("/account/zmw/momo/offramp", authorize, logRequestResponse, account.createZmwMomoAccount);
    router.post("/account/mwk/momo/offramp", authorize, logRequestResponse, account.createMwkMomoAccount);
    router.post("/account/tzs/momo/offramp", authorize, logRequestResponse, account.createTzsMomoAccount);
    router.post("/account/xaf/momo/offramp", authorize, logRequestResponse, account.createXafMomoAccount);
	router.post("/account/ngn/bank/offramp", authorize, logRequestResponse, account.createNgnBankAccount);
    router.post("/account/ugx/bank/offramp", authorize, logRequestResponse, account.createUgxBankAccount);
};
