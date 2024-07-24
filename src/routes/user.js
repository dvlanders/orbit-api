const { user } = require("../controllers");
const multer = require('multer');
const { authorize, logRequestResponse } = require("../util/middleware");

module.exports = (router) => {


	router.get("/ping", authorize, logRequestResponse, user.getPing);

	router.post("/user/create", authorize, logRequestResponse, user.createHifiUser);
	router.post("/user/create/async", authorize, logRequestResponse, user.createHifiUserAsync);
	router.post("/user/developer/create", authorize, logRequestResponse, user.createDeveloperUser)

	router.get("/user/all", authorize, logRequestResponse, user.getAllHifiUser)

	router.get("/user", authorize, logRequestResponse, user.getHifiUser);

	router.put("/user", authorize, logRequestResponse, user.updateHifiUser);
	router.put("/user/async", authorize, logRequestResponse, user.updateHifiUserAsync);

	router.post("/tos-link", authorize, logRequestResponse, user.generateToSLink)

	router.put("/tos-link", logRequestResponse, user.acceptToSLink)

};


