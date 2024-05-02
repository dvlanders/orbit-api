const { transactions } = require("../controllers");


module.exports = (router) => {
	// router.post("/transactions/send_confirmation_email", transactions.sendTransactionConfirmationEmail);

	router.get("/transactions/mesh", transactions.getTransaction);
};
