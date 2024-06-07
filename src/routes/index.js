module.exports = (app, express) => {
	const router = express.Router();
	const bastion = require("./bastion");
	const bridge = require("./bridge");
	const plaid = require("./plaid");
	const checkbook = require("./checkbook");

	bastion(router);
	bridge(router);
	plaid(router);
	checkbook(router);
	app.use("/", router);
};
