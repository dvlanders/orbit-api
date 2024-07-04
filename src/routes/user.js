const { user } = require("../controllers");
const multer = require('multer');
const { authorize } = require("../util/middleware");

module.exports = (router) => {


	router.get("/ping", authorize, user.getPing);

	router.post("/user/create", authorize, user.createHifiUser);

	router.get("/user/all", authorize, user.getAllHifiUser)

	router.get("/user", authorize, user.getHifiUser);

	router.put("/user", authorize, user.updateHifiUser);

	router.post("/tos-link", authorize, user.generateToSLink)

	router.put("/tos-link", user.acceptToSLink)

};


