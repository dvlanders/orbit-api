
const { auth } = require("../controllers")

module.exports = (router) => {
	router.post("/auth/apiKey", auth.createApiKey)
	router.get("/auth/apiKey", auth.getApiKey)
	router.post("/auth/createWebhook", auth.createWebhook)
	router.get("/auth/webhook", auth.getWebhook)
}