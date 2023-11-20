const { accountManagement } = require("../controllers");
const { authorizeUser } = require("../util/middleware");

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
    authorizeUser,
    accountManagement.wireInstructions
  );
  //account API
  router.get("/user/:user_id/myaccount", accountManagement.myAccount);
  //dashboard API
  router.get(
    "/user/:user_id/dashboard",
    authorizeUser,
    accountManagement.dashboard
  );
  //Team API
  router.get("/user/:user_id/team", accountManagement.team);
  router.post(
    "/user/:user_id/team/add",
    authorizeUser,
    accountManagement.addTeam
  );
  router.get(
    "/user/:user_id/team/acceptinvite",
    accountManagement.acceptInvite
  );
  router.get(
    "/user/:user_id/team/list",
    authorizeUser,
    accountManagement.teamList
  );
};
