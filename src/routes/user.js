const { user } = require("../controllers");
const multer = require('multer');
const { authorize, logRequestResponse, updateLastUserActivity } = require("../util/middleware");

module.exports = (router) => {


	router.get("/ping", authorize, logRequestResponse, user.getPing);

	router.post("/user/create", authorize, logRequestResponse, user.createHifiUser);
	router.post("/user/create/async", authorize, logRequestResponse, user.createHifiUserAsync);
	router.post("/user/developer/create", authorize, logRequestResponse, user.createDeveloperUser)

	router.get("/user/all", authorize, logRequestResponse, user.getAllHifiUser)

	router.get("/user", authorize, logRequestResponse, updateLastUserActivity, user.getHifiUser);
	router.get("/user/kyc/information", authorize, logRequestResponse, updateLastUserActivity, user.getUserKycInformation);
	router.get("/user/developer", authorize, logRequestResponse, updateLastUserActivity, user.getDeveloperUserStatus);


	router.put("/user", authorize, logRequestResponse, updateLastUserActivity, user.updateHifiUser);
	router.put("/user/async", authorize, logRequestResponse, updateLastUserActivity, user.updateHifiUserAsync);
	router.put("/user/developer", authorize, logRequestResponse, updateLastUserActivity, user.updateDeveloperUser);

	router.post("/tos-link", authorize, logRequestResponse, user.generateToSLink)

	router.put("/tos-link", logRequestResponse, user.acceptToSLink)
	router.get("/user/wallet/balance", authorize, logRequestResponse, updateLastUserActivity, user.getUserWalletBalance);
	router.get("/user/blindpay/receiver", authorize, logRequestResponse, user.getLatestBlindpayReceiver);
};


