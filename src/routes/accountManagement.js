/* Importing the `apiPath` object  from the `util` folder. */

const { accountManagement } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Bank routes
  router.post("/bank", accountManagement.linkBank);
  router.post("/verifybank", accountManagement.verifyBank);
  router.get("/bank", accountManagement.getBank);
  router.delete("/bank", accountManagement.deleteBank);
  router.get("/wireInstructions", accountManagement.wireInstructions);
};
