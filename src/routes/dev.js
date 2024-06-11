const { dev } = require("../controllers");
const multer = require('multer');
const { authorizeUser } = require("../util/middleware");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (router) => {

	router.post("/dev/testFileUpload", upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), dev.testFileUpload);
	
};
