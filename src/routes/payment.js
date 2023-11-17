const { payment } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  // transfer routes
  router.get("/transfer", payment.transfer);

  // transaction routes
  router.get(
    "/user/:user_id/transaction/:transaction_id",
    payment.internalTransaction
  );
  router.get("/user/:user_id/transaction", payment.transaction);
  router.put("/user/:user_id/:trx_id/transfer/update", payment.tranferUpdate);

  // monitization routes
  router.post("/monetization", payment.monetization);
  router.patch("/monetization/:monetization_id", payment.updateMonetization);
  router.delete("/monetization/:monetization_id", payment.deleteMonetization);
  router.delete("/monetization/history/?feature", payment.monetizationHistory);

  // Balance Routes
  router.get("/user/:user_id/balance", authorizeUser, payment.balances);
};
