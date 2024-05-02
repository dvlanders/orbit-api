const { bastion } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/bastion/v1/users/create", bastion.createUser);
	router.get("/bastion/v1/users/", bastion.getUser);

	router.get("/bastion/v1/userAction/", bastion.getUserAction);
	router.post("/bastion/transferUsdc/", bastion.transferUsdc);
	router.post("/bastion/submitKyc/", bastion.submitKyc);

};
