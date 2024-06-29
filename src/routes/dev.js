const { dev } = require("../controllers");
const multer = require('multer');
const { authorize } = require("../util/middleware");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (router) => {

	router.post("/dev/testFileUpload", upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), dev.testFileUpload);
	router.post("/dev/privateRoute", authorize, dev.privateRoute)
	router.post("/dev/webhook-receiver", dev.testwebhook)
};
