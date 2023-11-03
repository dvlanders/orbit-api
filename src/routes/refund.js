const { refund } = require("../controllers");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.get("/user/:user_id/wiretransfer", refund.wireTransfer);
  router.post("/user/:user_id/marketorder/:side", refund.MarketOrder);
  router.post("/user/:user_id/withdrawalBank", refund.withdrawalBank);
};
