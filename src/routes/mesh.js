const { mesh } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/mesh/v1/linktoken/create", mesh.createTransaction);
};
