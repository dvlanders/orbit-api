const { billing } = require("../controllers");

module.exports = (router) => {
    router.post("/webhook/stripe", billing.stripeWebhook)
};