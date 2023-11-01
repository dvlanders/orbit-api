const { upload } = require("../controllers");

module.exports = (router) => {
  router.post("/upload/:user_id/logo", upload.uploadImage);
};
