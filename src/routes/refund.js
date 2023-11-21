const { refund } = require("../controllers");
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  router.post(
    "/user/:user_id/withdrawalBank/:transaction_id",
    refund.withdrawalBank
  );
  // router.post(
  //   "/user/:user_id/marketorder/:side",
  //   authorizeUser,
  //   refund.MarketOrder
  // );
  router.post("/user/:user_id/marketorder", authorizeUser, refund.marketOrder);
  router.post("/user/:user_id/wallettransfer", refund.walletTransfer);
  //   router.post("/user/:user_id/withdrawalBank", refund.withdrawalBank);
};
