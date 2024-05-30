const { transactions } = require("../controllers");


module.exports = (router) => {
	router.get("/transactions/mesh", transactions.getTransaction);
};
