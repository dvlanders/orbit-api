const { walletConnect } = require("../controllers");

module.exports = (router) => {
  // transfer routes
  router.post("/user/:user_id/wallettransfer", walletConnect.walletTransfer);
  //   router.get("/user/:user_id/deposit", walletConnect.deposit);
  router.get("/add/currency", walletConnect.walletCurrency);
  router.get("/currency/list", walletConnect.getCurrency);
  router.post("/user/:user_id/wallet/add", walletConnect.addWallet);
};
