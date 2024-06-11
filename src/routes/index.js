module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const dev = require("./dev")
	const account = require("./account");

	user(router);
	dev(router)
	account(router);


	app.use("/", router);
};
