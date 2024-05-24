const { request } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.post("/request/create", request.createRequest);

};
