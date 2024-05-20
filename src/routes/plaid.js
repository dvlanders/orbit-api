const { plaid } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.post("/plaid/item/public_token/exchange", plaid.exchangePublicTokenForAccessToken);
	router.post("/plaid/processor/token/create", plaid.exchangeAccessTokenForProcessorToken);

};
