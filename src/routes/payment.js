/* Importing the `apiPath` object  from the `util` folder. */

const { payment } = require("../controllers")
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Bank routes
  router.post("/bank", authorizeUser, payment.linkBank);
  router.post("/verifybank", authorizeUser,  payment.verifyBank);
  router.get("/bank", authorizeUser,  payment.getBank);
  router.delete("/bank", authorizeUser,  payment.deleteBank);
  router.get("/wireInstructions", authorizeUser,  payment.wireInstructions)
// Transfer routes
  router.post("/transfer", authorizeUser, payment.transfer);
  router.post("/confirmtransfer", authorizeUser,  payment.confirmTransfer)
  router.delete("/transfer", authorizeUser, payment.deleteTransfer)
  router.post("/transferStatus/&from_date&to_date&type&purpose&status", authorizeUser, payment.transferStatus)
  // monitization routes
  router.post("/monetization", authorizeUser, payment.monetization);
  router.patch("/monetization/:monetization_id", authorizeUser,  payment.updateMonetization);
  router.delete("/monetization/:monetization_id", authorizeUser,  payment.deleteMonetization);
  router.delete("/monetization/history/?feature", authorizeUser,  payment.monetizationHistory);



  


};