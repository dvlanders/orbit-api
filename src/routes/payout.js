/* Importing the `apiPath` object  from the `util` folder. */

const { payout } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.post("/transfer", payout.createTransfer);
  router.post("/confirmtransfer", payout.confirmTransfer);
  router.delete("/transfer", payout.deleteTransfer);
  router.post(
    "/transferStatus/&from_date&to_date&type&purpose&status",
    payout.transferStatus
  );

  // withdrawal routes
  router.post("/user/:user_id/withdrawal", payout.withdrawal);
  router.post("/user/:user_id/withdrawal/resend", payout.resendWithdrawal);
  router.delete("/user/:user_id/cancelWithdrawal", payout.cancelWithdrawal);
};
