
const { auth } = require("../controllers")

module.exports = (router) => {
	router.post("/auth/apiKey", auth.createApiKey)
}