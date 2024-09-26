const { user } = require("../../controllers");
const { authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse } = require("../../util/middleware");

module.exports = (router) => {

	router.post("/dashboard/user/create", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.createHifiUser);
	router.post("/dashboard/user/create/async", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.createHifiUserAsync);
	router.post("/dashboard/user/developer/create", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, user.createDeveloperUser)

	router.get("/dashboard/user/all", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.getAllHifiUser)

	router.get("/dashboard/user", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.getHifiUser);
	router.get("/dashboard/user/developer", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.getDeveloperUserStatus);
	router.post("/dashboard/user/developer/gas-station-wallet", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, user.createDeveloperUserGasStationWallet)

	router.put("/dashboard/user", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.updateHifiUser);
	router.put("/dashboard/user/async", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.updateHifiUserAsync);
	router.put("/dashboard/user/developer", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, user.updateDeveloperUser);


	//added requestresponse middleware
	router.post("/dashboard/tos-link", authorizeDashboard, logRequestResponse, requiredProdDashboard, logRequestResponse, user.generateToSLink)
	router.get("/dashboard/user/userKyc", authorizeDashboard, requiredProdDashboard, logRequestResponse, user.getUserKycInformation)
};


