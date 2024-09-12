const { internalUser } = require("../../controllers");
const { authorize } = require("../../util/middleware");

module.exports = (router) => {
	router.post("/internal/user/freeze", authorize, internalUser.freeze);
	router.post("/internal/user/unfreeze", authorize, internalUser.unfreeze);
};


