module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const dev = require("./dev")
	const account = require("./account");
	const transfer = require("./transfer");
	const auth = require("./auth")
	const dashboardTransfer = require("./dashboard/transfer")
	const dashboardUser = require("./dashboard/user")

	user(router);
	dev(router);
	transfer(router);
	account(router);
	auth(router)
	dashboardTransfer(router)
	dashboardUser(router)


	app.use("/", router);
};
