const { user } = require("../../controllers");
const { authorizeDashboard } = require("../../util/middleware");

module.exports = (router) => {

	router.post("/dashboard/user/create", authorizeDashboard, user.createHifiUser);
	router.post("/dashboard/user/create/async", authorizeDashboard, user.createHifiUserAsync);

	router.get("/dashboard/user/all", authorizeDashboard, user.getAllHifiUser)

	router.get("/dashboard/user", authorizeDashboard, user.getHifiUser);

	router.put("/dashboard/user", authorizeDashboard, user.updateHifiUser);
	router.put("/dashboard/user/async", authorizeDashboard, user.updateHifiUserAsync);

	router.post("/dashboard/tos-link", authorizeDashboard, user.generateToSLink)
	router.get("/dashboard/user/userKyc", authorizeDashboard, user.getUserKycInformation)
};


