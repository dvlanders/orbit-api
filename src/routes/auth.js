
const { auth } = require("../controllers")
const { logRequestResponse } = require("../util/middleware");

module.exports = (router) => {
	router.post("/auth/apiKey", logRequestResponse, auth.createApiKey)
	router.get("/auth/apiKey", logRequestResponse, auth.getApiKey)
	router.post("/auth/createWebhook", logRequestResponse, auth.createWebhook)
	router.get("/auth/webhook", logRequestResponse, auth.getWebhook)
}