const { requests } = require("../controllers");


module.exports = (router) => {
	router.post("/requests/sendRequestCreateEmail", requests.sendRequestCreateEmail);
};
