module.exports = (app, express) => {
	const router = express.Router();

	const bastion = require("./bastion");
	const user = require("./user");
	const dev = require("./dev")




	bastion(router);
	user(router);
	dev(router)

	app.use("/", router);
};
