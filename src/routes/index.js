module.exports = (app, express) => {
	const router = express.Router();

	const bastion = require("./bastion");
	const user = require("./user");




	bastion(router);
	user(router);

	app.use("/", router);
};
