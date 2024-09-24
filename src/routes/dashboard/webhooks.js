const { webhooks } = require("../../controllers");
const { authorizeDashboard } = require("../../util/middleware");


module.exports = (router) => {
    router.get("/dashboard/webhooks/getAllWebhookHistory", authorizeDashboard, webhooks.getAllWebhookHistory)
    router.post("/dashboard/webhooks/resendWebhookMessage", authorizeDashboard, webhooks.resendWebhookMessage)
}