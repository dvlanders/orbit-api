const { notification } = require("../controllers");

module.exports = (router) => {
	router.post("/notification/sendRequestCreateEmail", notification.sendRequestCreateEmail);
    router.post("/notification/sendConfirmationEmail", notification.sendTransactionConfirmationEmail);

};