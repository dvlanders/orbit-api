/* Importing the `apiPath` object  from the `util` folder. */

const { payout } = require("../controllers")
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Bank routes
  router.post("/withdrawal", authorizeUser ,  payout.withdrawal);
  router.post("/withdrawal/resend", authorizeUser ,  payout.resendWithdrawal)
  router.delete("/cancelWithdrawal", authorizeUser ,  payout.cancelWithdrawal)
};