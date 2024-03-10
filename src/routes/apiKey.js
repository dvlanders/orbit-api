const { generateApiKey, getApiKeys } = require("../controllers/apiKey");
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	// FIXME: Add authorizeUser middleware
	// router.post("/merchant/api-keys/generate", authorizeUser, generateApiKey);
	router.post("/merchant/api-keys/generate", generateApiKey);
	router.get("/merchant/api-keys", getApiKeys);
};
