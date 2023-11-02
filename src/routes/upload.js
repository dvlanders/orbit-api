const { upload } = require("../controllers");

module.exports = (router) => {
  router.post("/user/:user_id/upload/logo", upload.uploadImage);
  router.get("/user/:user_id/logo",upload.getLogo)
};
