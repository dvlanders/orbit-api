const { utils } = require("../controllers");
const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {
  router.get("/utils/exchangeRate", authorizeUser, utils.exchangeRate);
};