/* Importing the `apiPath` object  from the `util` folder. */

const { payment } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Transaction routes
  router.get("/transfer", payment.transfer);
  // monitization routes
  router.post("/monetization",payment.monetization);
  router.patch("/monetization/:monetization_id",payment.updateMonetization);
  router.delete("/monetization/:monetization_id",payment.deleteMonetization);
  router.delete("/monetization/history/?feature",payment.monetizationHistory);
  router.get("/balance",payment.balances)


  


};
