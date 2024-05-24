const { utils } = require("../controllers");

module.exports = (router) => {
  router.get("/utils/exchangeRate", utils.exchangeRate);
};