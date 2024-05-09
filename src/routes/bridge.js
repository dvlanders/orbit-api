const { bridge } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/bridge/v0/customers/tos_links", bridge.createTermsOfServiceLink);
	router.post("/bridge/v0/customers", bridge.createNewBridgeCustomer);
	router.post("/bridge/v0/customers/virtual_account", bridge.createVirtualAccount);
	router.post("/bridge/v0/customers/external_account", bridge.createExternalAccount);
	router.get("/bridge/v0/customers", authorizeUser, bridge.getCustomer);
	router.put("/bridge/v0/customers/update", bridge.updateBridgeCustomer);
};
