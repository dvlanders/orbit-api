const { refund } = require("../controllers");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.post("/user/:user_id/achtransfer", refund.achTransfer);
  router.post("/user/:user_id/marketorder/:side", refund.MarketOrder);
};
