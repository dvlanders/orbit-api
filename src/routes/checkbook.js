const { checkbook } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.post("/checkbook/create_user", authorizeUser, checkbook.createCheckbookUser);


};
