const { request } = require("../controllers");

const { authorizeUser } = require("../util/middleware");

module.exports = (router) => {

	router.post("/request/create", authorizeUser, request.createRequest);
	router.put("/request/reject", authorizeUser, request.rejectRequest);
	router.put("/request/cancel", authorizeUser, request.cancelRequest);

};
