const { checkbook } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.post("/checkbook/create_user", authorizeUser, checkbook.createCheckbookUser);
	router.post("/checkbook/account/plaid", checkbook.createCheckbookBankAccountWithProcessorToken);
	router.post("/checkbook/account/bridge_virtual_account", checkbook.createCheckbookAccountForBridgeVirtualAccount);
	router.post("/checkbook/execute_pull_transaction", checkbook.executeCheckbookPullTransaction);


};
