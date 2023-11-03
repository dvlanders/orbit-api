const { user } = require("../controllers");

module.exports = (router) => {
  router.post("/signup", user.signUp);
  router.post("/signin", user.signIn);
  router.post("/user/:userId/verifytotp", user.verifyTOTP);
  router.patch("/user/:userId/changepassword", user.changePassword);
  router.post("/user/forgotpassword", user.forgotPassword);
  router.patch("/user/:userId/resetpassword", user.resetPassword);
  router.post("/signingoogle", user.signInGoogle);
};
