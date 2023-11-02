const { registration } = require("../controllers");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  router.post("/register", registration.register);
  router.post("/otp/:userId", registration.requestOTP);
  router.post("/verify/:userId", registration.verify);
  router.post("/user/token/:userId", registration.userToken);
  router.delete("/user/:userId", registration.deleteUser);
  router.get("/users", registration.getUser);
 
};
