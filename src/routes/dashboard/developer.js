const { developerDashboard } = require("../../controllers");
const { logRequestResponse, requiredAdmin, authorizeDashboard } = require("../../util/middleware");


module.exports = (router) => {
    router.post("/dashboard/developer/withdraw-gas", authorizeDashboard, requiredAdmin, logRequestResponse, developerDashboard.withdrawFromGasWallet);
}