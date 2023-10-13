const { registration } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  router.post("/register", registration.register);
  router.post("/otp/:userId", registration.requestOTP);
  router.post("/verify/:userId", registration.verify);
  router.post("/user/token/:userId", registration.userToken);
};
