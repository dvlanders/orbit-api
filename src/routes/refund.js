/* Importing the `apiPath` object  from the `util` folder. */

const { refund } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.post("/user/:user_id/achtransfer", refund.achTransfer);
  router.post("/user/:user_id/marketorder/:side", refund.MarketOrder);

};
