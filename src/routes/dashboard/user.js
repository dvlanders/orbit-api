const { user } = require("../../controllers");
const { authorizeDashboard } = require("../../util/middleware");

module.exports = (router) => {

	router.post("/dashboard/user/create", authorizeDashboard, user.createHifiUser);

	router.get("/dashboard/user/all", authorizeDashboard, user.getAllHifiUser)

	router.get("/dashboard/user", authorizeDashboard, user.getHifiUser);

	router.put("/dashboard/user", authorizeDashboard, user.updateHifiUser);

	router.post("/dashboard/tos-link", authorizeDashboard, user.generateToSLink)

};


