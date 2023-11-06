const { accountManagement } = require("../controllers");

module.exports = (router) => {
  // Bank routes
  router.post("/user/:user_id/bank", accountManagement.linkBank);
  router.post("/user/:user_id/verifybank/:bank_id",accountManagement.verifyBank);
  router.get("/user/:user_id/bank/:bank_id", accountManagement.getBank);
  router.get("/user/:user_id/bank", accountManagement.getAllBank);
  router.delete("/user/:user_id/bank/:bank_id", accountManagement.deleteBank);
  router.get(
    "/user/:user_id/wireInstructions",
    accountManagement.wireInstructions
  );
  //customer API
  router.get("/user/:user_id/customers", accountManagement.customer);
  router.get("/user/:user_id/customers/:customer_id",accountManagement.customerDetails);
  //account API
  router.get("/user/:user_id/myaccount", accountManagement.myAccount);
  //dashboard API
  router.get("/user/:user_id/dashboard", accountManagement.dashboard);
  //Team API
  router.get("/user/:user_id/team", accountManagement.team);


};
