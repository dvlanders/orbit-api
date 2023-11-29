const { payout } = require("../controllers");
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // transfer routes
  router.post("/transfer/:cuser_id", payout.createTransfer);
  router.post(
    "/user/:user_id/:transfer_id/confirmtransfer",
    payout.confirmTransferPayment
  );
  router.delete("/transfer", payout.deleteTransfer);
  router.post(
    "/transferStatus/&from_date&to_date&type&purpose&status",
    payout.transferStatus
  );
  router.post(
    "/user/:user_id/withdrawalcalculation",
    payout.withdrawalCalculation
  );

  // withdrawal routes
  router.post("/user/:user_id/withdrawal", payout.withdrawal);
  router.post("/user/:user_id/withdrawal/resend", payout.resendWithdrawal);
  router.delete("/user/:user_id/cancelWithdrawal", payout.cancelWithdrawal);
  router.post("/transfer/:cuser_id", payout.createTransfer);
  // router.post("/transfer/:user_id/payout", authorizeUser, payout.makeTranfer);
};
