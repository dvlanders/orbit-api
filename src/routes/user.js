/* Importing the `apiPath` object  from the `util` folder. */
const {  userApiPath } = require("../util");

const { user } = require("../controllers");
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  router.post("/signup", user.signUp);
  router.post("/signin", user.signIn);
  router.post("/user/:userId/verifytotp", user.verifyTOTP);
  router.patch("/user/changepassword", authorizeUser,  user.changePassword);
  router.post("/user/forgotpassword", authorizeUser, user.forgotPassword);
  router.patch("/user/resetpassword", authorizeUser,  user.resetPassword)
};
