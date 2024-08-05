const { user } = require("../../controllers");
const { authorizeDashboard, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");

module.exports = (router) => {

	router.post("/dashboard/user/create", authorizeDashboard, requiredProdDashboard,user.createHifiUser);
	router.post("/dashboard/user/create/async", authorizeDashboard, requiredProdDashboard,user.createHifiUserAsync);
	router.post("/dashboard/user/developer/create", authorizeDashboard, requiredProdDashboard, requiredAdmin, user.createDeveloperUser)

	router.get("/dashboard/user/all", authorizeDashboard, requiredProdDashboard,user.getAllHifiUser)

	router.get("/dashboard/user", authorizeDashboard, requiredProdDashboard,user.getHifiUser);
	router.get("/dashboard/user/developer", authorizeDashboard, requiredProdDashboard, user.getDeveloperUserStatus);


	router.put("/dashboard/user", authorizeDashboard, requiredProdDashboard,user.updateHifiUser);
	router.put("/dashboard/user/async", authorizeDashboard, requiredProdDashboard,user.updateHifiUserAsync);
	router.put("/dashboard/user/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, user.updateDeveloperUser);

	router.post("/dashboard/tos-link", authorizeDashboard, requiredProdDashboard,user.generateToSLink)
	router.get("/dashboard/user/userKyc", authorizeDashboard, requiredProdDashboard, user.getUserKycInformation)
};


