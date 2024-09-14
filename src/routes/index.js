module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const dev = require("./dev")
	const account = require("./account");
	const transfer = require("./transfer");
	const auth = require("./auth")
	const dashboardTransfer = require("./dashboard/transfer")
	const dashboardUser = require("./dashboard/user")
	const dashboardUtils = require("./dashboard/utils")
	const dashboardAccount = require("./dashboard/account")
	const billing = require("./billing")
	const externalWebhooks = require("./webhook")
	const webhooks = require("./dashboard/webhooks")
	const localUser = require("./localAdmin.js/user")
	const internalUser = require("./internal/user")
	const internalBilling = require("./internal/billing")

	user(router);
	dev(router);
	transfer(router);
	account(router);
	auth(router)
	dashboardTransfer(router)
	dashboardUser(router)
	dashboardUtils(router)
	billing(router)
	externalWebhooks(router)
	dashboardAccount(router)
	webhooks(router)
	localUser(router)
	internalUser(router)
	internalBilling(router)

	app.use("/", router);
};
