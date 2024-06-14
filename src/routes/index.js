module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const dev = require("./dev")
	const account = require("./account");
	const transfer = require("./transfer");
	const auth = require("./auth")

	user(router);
	dev(router)
	transfer(router)
	account(router);
	auth(router)


	app.use("/", router);
};
