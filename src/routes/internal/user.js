const { internalUser } = require("../../controllers");

module.exports = (router) => {
	router.post("/internal/user/freeze", internalUser.freeze);
	router.post("/internal/user/unfreeze", internalUser.unfreeze);
};


