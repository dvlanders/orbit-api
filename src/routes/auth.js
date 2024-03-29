const { auth } = require("../controllers");

const { validateApiKey } = require("../util//apiValidationMiddleware");

module.exports = (router) => {
	router.post("/auth/token/generate", validateApiKey, auth.generatePageToken);
};
