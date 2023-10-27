/* Importing the `apiPath` object  from the `util` folder. */

const { accountManagement } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Bank routes
  router.post("/user/:user_id/bank", accountManagement.linkBank);
  router.post("/user/:user_id/verifybank", accountManagement.verifyBank);
  router.get("/user/:user_id/bank", accountManagement.getBank);
  router.delete("/user/:user_id/bank", accountManagement.deleteBank);
  router.get("/user/:user_id/wireInstructions",accountManagement.wireInstructions);
  router.get("/customers", accountManagement.customer);
  router.get("/user/:user_id/myaccount",accountManagement.myAccount);
};
