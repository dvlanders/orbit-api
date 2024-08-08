const { webhooks } = require("../../controllers");
const { authorizeDashboard } = require("../../util/middleware");


module.exports = (router) => {
    router.get("/dashboard/webhooks/getWalletBalance", authorizeDashboard, webhooks.getAllWebhook)

}