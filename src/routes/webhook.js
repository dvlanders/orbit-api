const { externalWebhooks } = require("../controllers");
const { signatureVerification } = require("../util/bridge/webhook/middleware");

module.exports = (router) => {
  router.post(
    "/webhook/bridge",
    signatureVerification,
    externalWebhooks.bridgeWebhook
  );
};
