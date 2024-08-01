
const { auth } = require("../controllers")
const { logRequestResponse, authorizeDashboard } = require("../util/middleware");

module.exports = (router) => {
	router.post("/auth/apiKey", authorizeDashboard, logRequestResponse, auth.createApiKey)
	router.get("/auth/apiKey", logRequestResponse, auth.getApiKey)
	router.delete("/auth/apiKey", authorizeDashboard,logRequestResponse, auth.deleteApiKey)
	router.post("/auth/createWebhook", logRequestResponse, auth.createWebhook)
	router.get("/auth/webhook", logRequestResponse, auth.getWebhook)
}