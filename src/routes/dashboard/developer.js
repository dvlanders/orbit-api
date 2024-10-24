const { developerDashboard } = require("../../controllers");
const { logRequestResponse, requiredAdmin, authorizeDashboard, requiredProdDashboard } = require("../../util/middleware");


module.exports = (router) => {
    router.post("/dashboard/developer/withdraw-gas", authorizeDashboard, requiredProdDashboard, requiredAdmin, logRequestResponse, developerDashboard.withdrawFromGasWallet);
}