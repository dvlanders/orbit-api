const { billing } = require("../../controllers");
const { authorizeDashboard, logRequestResponse, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");

module.exports = (router) => {
    // TODO: add middlewares: authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse,
    router.post("/dashboard/billing/setup-intent", billing.createSetupIntent);
    router.post("/dashboard/billing/autopay", billing.setUpAutoPay);
    router.post("/dashboard/billing/checkout-session", billing.createCheckoutSession);
};

