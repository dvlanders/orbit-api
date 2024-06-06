const { bridge } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
	router.post("/bridge/v0/customers/tos_links", bridge.createTermsOfServiceLink);
	router.post("/bridge/v0/customers", bridge.createNewBridgeCustomer);
	router.post("/bridge/v0/customers/virtual_account", authorizeUser, bridge.createVirtualAccount);
	router.post("/bridge/v0/customers/external_account", authorizeUser, bridge.createExternalAccount);
	router.get("/bridge/v0/customers", authorizeUser, bridge.getCustomer);
	router.put("/bridge/v0/customers/update", bridge.updateBridgeCustomer);
	router.post("/bridge/v0/customers/liquidation_addresses", authorizeUser, bridge.createLiquidationAddress);
	router.get("/bridge/v0/drain_history", authorizeUser, bridge.getDrainHistory);
	router.get("/bridge/v0/virtual_account/history", authorizeUser, bridge.getVirtualAccountHistory);
	router.get("/bridge/v0/hosted_kyc_link", bridge.getHostedKycLinkForSepaEndorsement);


};
