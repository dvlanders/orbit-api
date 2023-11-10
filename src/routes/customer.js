const { customer } = require("../controllers");
const { authorizeUser } = require("../util/middleware");
module.exports = (router) => {
  // Bank route
  router.get(
    "/user/:user_id/customer/list",
    authorizeUser,
    customer.merchantCustomer
  );
};
