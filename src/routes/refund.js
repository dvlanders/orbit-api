const { refund } = require("../controllers");
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  router.post(
    "/user/:user_id/withdrawalBank/:transaction_id",
    refund.withdrawalBank
  );
  router.post(
    "/user/:user_id/:id/refund/customer",
    authorizeUser,
    refund.reundCustomer
  );
  router.post("/user/:user_id/wallettransfer", refund.walletTransfer);
  //   router.post("/user/:user_id/withdrawalBank", refund.withdrawalBank);
  router.get(
    "/user/:user_id/refund/:rid/status",
    authorizeUser,
    refund.getRefundStatus
  );
  router.post(
    "/user/:user_id/refund/confirm",
    authorizeUser,
    refund.confirmRefund
  );
};
