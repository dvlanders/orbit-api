/* Importing the `apiPath` object  from the `util` folder. */

const { registration } = require("../controller")
/* Importing the `authorizeUser` function from the `authmiddleware` folder. */
// const { authorizeUser } = require("../middleware/authmiddleware");

module.exports = (router) => {
  /* This is a route that will be used to add a new user to the database. */
  router.post("/register",registration.register);

  
};