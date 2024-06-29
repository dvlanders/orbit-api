
const { auth } = require("../controllers")

module.exports = (router) => {
	router.post("/auth/apiKey", auth.createApiKey)
	router.post("/auth/createWebhook", auth.createWebhook)
}