const { billing } = require("../../controllers");
const { authorizeDashboard, logRequestResponse, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");

module.exports = (router) => {
    // TODO: add middlewares: authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse,
    router.post("/dashboard/billing/setup-intent", authorizeDashboard, requiredAdmin, logRequestResponse, billing.createSetupIntent);
    router.post("/dashboard/billing/autopay", authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse, billing.setUpAutoPay);
    router.post("/dashboard/billing/checkout-session", authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse, billing.createCheckoutSession);
    router.get("/dashboard/billing/credit-balance", authorizeDashboard, requiredProdDashboard, requiredAdmin ,logRequestResponse, billing.getCreditBalance)
};

