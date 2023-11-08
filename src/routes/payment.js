const { payment } = require("../controllers");

module.exports = (router) => {
  // transfer routes
  router.get("/transfer", payment.transfer);

  // transaction routes
  router.get("/user/:user_id/transaction", payment.transaction);
  router.put(
    "/user/:user_id/:trx_id/transfer/update",
    payment.tranferUpdate
  );

  // monitization routes
  router.post("/monetization", payment.monetization);
  router.patch("/monetization/:monetization_id", payment.updateMonetization);
  router.delete("/monetization/:monetization_id", payment.deleteMonetization);
  router.delete("/monetization/history/?feature", payment.monetizationHistory);

  // balance routes
  router.get("/user/:user_id/balance", payment.balances);
};
