const { ocpp } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/ocpp/registeroperator", ocpp.registerOperator);
};
