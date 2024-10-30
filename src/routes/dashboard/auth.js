const { account, dashboardAuth } = require("../../controllers");
const { authorizeDashboard, logRequestResponse, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");


module.exports = (router) => {
    router.post("/dashboard/auth/onboard", authorizeDashboard, logRequestResponse, dashboardAuth.onboard)
    router.get("/dashboard/auth/apiKey", authorizeDashboard, logRequestResponse, dashboardAuth.retrieveEncryptedApiKey)
};