const { user } = require("../controllers");
const multer = require('multer');
const { authorize, logRequestResponse } = require("../util/middleware");

module.exports = (router) => {


	router.get("/ping", authorize, logRequestResponse, user.getPing);

	router.post("/user/create", authorize, user.createHifiUser);
	router.post("/user/create/async", authorize, user.createHifiUserAsync);

	router.get("/user/all", authorize, user.getAllHifiUser)

	router.get("/user", authorize, user.getHifiUser);

	router.put("/user", authorize, user.updateHifiUser);
	router.put("/user/async", authorize, user.updateHifiUserAsync);

	router.post("/tos-link", authorize, user.generateToSLink)

	router.put("/tos-link", user.acceptToSLink)

};


