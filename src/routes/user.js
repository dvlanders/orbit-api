const { bastion } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.get("/get_ping", bastion.getPing);
	router.post("/user/create", bastion.createUser);

};
