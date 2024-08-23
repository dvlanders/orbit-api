const { user } = require("../../controllers");
const multer = require('multer');
const { localAdmin } = require("../../util/middleware");

module.exports = (router) => {

	router.post("/local/user/create", localAdmin, user.createHifiUser);
	router.post("/local/user/create/async", localAdmin, user.createHifiUserAsync);
	router.post("/local/user/developer/create", localAdmin, user.createDeveloperUser)

	router.get("/local/user/all", localAdmin, user.getAllHifiUser)

	router.get("/local/user", localAdmin, user.getHifiUser);
	router.get("/local/user/developer", localAdmin, user.getDeveloperUserStatus);

	router.put("/local/user", localAdmin, user.updateHifiUser);
	router.put("/local/user/async", localAdmin, user.updateHifiUserAsync);
	router.get("/local/user/wallet/balance", localAdmin, user.getUserWalletBalance);

};


