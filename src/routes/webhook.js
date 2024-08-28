const { externalWebhooks } = require("../controllers");
const { signatureVerification } = require("../util/bridge/webhook/middleware");
const { verifyReapSignature } = require("../util/reap/webhooks/verifySignature");

module.exports = (router) => {
  router.post(
    "/webhook/bridge",
    signatureVerification,
    externalWebhooks.bridgeWebhook
  );

  router.post("/webhook/reap", verifyReapSignature, externalWebhooks.reapWebhook);
  router.post("/webhook/bridge", signatureVerification, externalWebhooks.bridgeWebhook);
  // router.post("/webhook/blindpay", externalWebhooks.blindpayWebhook);
};
