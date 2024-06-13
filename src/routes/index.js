module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const dev = require("./dev")
	const account = require("./account");
	const transfer = require("./transfer")

	user(router);
	dev(router)
	account(router);
	transfer(router)


	app.use("/", router);
};
