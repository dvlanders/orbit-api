/* Importing the `apiPath` object  from the `util` folder. */

const { payment } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.get("/transfer", payment.transfer);

  // transaction routes
  router.get("/user/:user_id/transaction/:transfer_id", payment.transaction);
  router.put("/user/:user_id/:trx_id/transaction/update",payment.transactionUpdate);

  // monitization routes
  router.post("/monetization", payment.monetization);
  router.patch("/monetization/:monetization_id", payment.updateMonetization);
  router.delete("/monetization/:monetization_id", payment.deleteMonetization);
  router.delete("/monetization/history/?feature", payment.monetizationHistory);

  // balance routes
  router.get("/user/:user_id/balance", payment.balances);
};
