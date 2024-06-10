module.exports = (app, express) => {
	const router = express.Router();
	const user = require("./user");
	const account = require("./account");

	user(router);
	account(router);


	app.use("/", router);
};
