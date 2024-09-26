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
	const dashboardBilling = require("./dashboard/billing")
	const dashboardDeveloper = require("./dashboard/developer")
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
	dashboardBilling(router)
	externalWebhooks(router)
	dashboardAccount(router)
	webhooks(router)
	localUser(router)
	internalUser(router)
	internalBilling(router)
	dashboardDeveloper(router)

	app.use("/", router);
};
