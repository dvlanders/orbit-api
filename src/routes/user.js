const { user } = require("../controllers");
const multer = require('multer');
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.get("/get_ping", user.getPing);
	// TODO: router.get("/wallet_address", user.getPing);
	router.post("/user/create", user.createHifiUser);

};
