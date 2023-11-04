const { accountManagement } = require("../controllers");

module.exports = (router) => {
  // Bank routes
  router.post("/user/:user_id/bank", accountManagement.linkBank);
  router.post(
    "/user/:user_id/verifybank/:bank_id",
    accountManagement.verifyBank
  );
  router.get("/user/:user_id/bank/:bank_id", accountManagement.getBank);
  router.get("/user/:user_id/bank", accountManagement.getAllBank);
  router.delete("/user/:user_id/bank/:bank_id", accountManagement.deleteBank);
  router.get(
    "/user/:user_id/wireInstructions",
    accountManagement.wireInstructions
  );
  router.get("/user/:user_id/customers", accountManagement.customer);
  router.get(
    "/user/:user_id/customers/:customer_id",
    accountManagement.customerDetails
  );
  router.get("/user/:user_id/myaccount", accountManagement.myAccount);
  router.get("/user/:user_id/dashboard", accountManagement.dashboard);
};
