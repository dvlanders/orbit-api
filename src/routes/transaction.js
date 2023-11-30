const { transaction } = require("../controllers");
const { authorizeUser } = require("../util/middleware");
module.exports = (router) => {
  // Bank route
  router.get(
    "/user/:user_id/customer/list",
    authorizeUser,
    transaction.merchantCustomerList
  );

  router.get(
    "/user/:user_id/customer/:cid/internal/list",
    authorizeUser,
    transaction.internalMerchantCustomer
  );

  router.get(
    "/user/:user_id/customer/internal/:txhash",
    authorizeUser,
    transaction.internalMerchantCustomerOne
  );

  router.get(
    "/user/:user_id/internal/list",
    authorizeUser,
    transaction.internalMerchantCustomerList
  );

  router.get(
    "/user/:user_id/receipt/:txnid/update",
    authorizeUser,
    transaction.updateReceipt
  );
};
