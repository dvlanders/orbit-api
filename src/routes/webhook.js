const { externalWebhooks } = require("../controllers");
const { signatureVerification } = require("../util/bridge/webhook/middleware");
const { stripeSignatureVerification } = require("../util/stripe/webhook/middleware");
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
  router.post("/webhook/stripe", stripeSignatureVerification, externalWebhooks.stripeWebhook)
};
