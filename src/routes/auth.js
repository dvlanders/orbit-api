const { auth } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/auth/token/generate", auth.generatePageToken);
};
