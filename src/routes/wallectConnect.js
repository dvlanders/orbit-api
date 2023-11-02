const { walletConnect } = require("../controllers");

module.exports = (router) => {
  // transfer routes
  router.post("/user/:user_id/wallettransfer", walletConnect.walletTransfer);
//   router.get("/user/:user_id/deposite", walletConnect.deposit);
};
