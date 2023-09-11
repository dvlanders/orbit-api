/* Importing the `apiPath` object  from the `util` folder. */
const {  userApiPath } = require("../util");

const { userApi } = require("../controller/index")
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
// const { authorizeUser } = require("../middleware/authmiddleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  router.get(
    userApiPath.addUser,
    // authorizeUser,
    userApi.addUser
  );

  router.post(
    userApiPath.signup,
    userApi.signup
  );

  router.post(
    userApiPath.signin,
    userApi.signin
  )
};
