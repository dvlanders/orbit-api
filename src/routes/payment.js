/* Importing the `apiPath` object  from the `util` folder. */

const { payment } = require("../controllers")
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
// const { authorizeUser } = require("../middleware/authmiddleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  // Bank routes
  router.post("/bank",payment.linkBank);
  router.post("/verifybank", payment.verifyBank);
  router.get("/bank", payment.getBank);
  router.delete("/bank", payment.deleteBank);
  router.get("/wireInstructions", payment.wireInstructions)
// Transfer routes
  router.post("/transfer",payment.transfer);
  router.post("/confirmtransfer", payment.confirmTransfer)
  router.delete("/transfer",payment.deleteTransfer)
  router.post("/transferStatus/&from_date&to_date&type&purpose&status",payment.transferStatus)
  // monitization routes
  router.post("/monetization",payment.monetization);
  router.patch("/monetization/:monetization_id", payment.updateMonetization);
  router.delete("/monetization/:monetization_id", payment.deleteMonetization);
  router.delete("/monetization/history/?feature", payment.monetizationHistory);



  


};