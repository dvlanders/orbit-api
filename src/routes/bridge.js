const { bridge } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/bridge/v0/customers/tos_links", bridge.createTermsOfServiceLink);
	router.post("/bridge/v0/customers", bridge.createNewBridgeCustomer);
};
