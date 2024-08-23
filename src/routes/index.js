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
	const webhooks = require("./dashboard/webhooks")
	const localUser = require("./localAdmin.js/user")

	user(router);
	dev(router);
	transfer(router);
	account(router);
	auth(router)
	dashboardTransfer(router)
	dashboardUser(router)
	dashboardUtils(router)
	billing(router)
	dashboardAccount(router)
	webhooks(router)
	localUser(router)

	app.use("/", router);
};
