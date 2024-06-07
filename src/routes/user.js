const { user } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.get("/get_ping", user.getPing);
	router.post("/user/create", user.createHifiUser);

};
