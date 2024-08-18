const { bridge } = require("../../controllers");
const {
  signatureVerification,
} = require("../../util/bridge/webhook/middleware");

module.exports = (router) => {
  router.post("/webhook/bridge", signatureVerification, bridge.bridgeWebhook);
};
