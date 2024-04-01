const { mesh } = require("../controllers");

const { validateApiKey } = require("../util//apiValidationMiddleware");

module.exports = (router) => {
	console.log('****************mesh routes')
	router.post("/mesh/v1/linktoken/create", mesh.createTransaction);
};
