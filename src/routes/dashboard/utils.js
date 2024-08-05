
const { dashboard } = require("../../controllers");
const { authorize, authorizeDashboard, requiredProdDashboard, requiredAdmin } = require("../../util/middleware");

module.exports = (router) => {
    router.get("/dashboard/utils/getWalletBalance", authorizeDashboard, requiredProdDashboard, dashboard.getWalletBalance)
    router.get("/dashboard/utils/getTotalTransactionVolume", authorizeDashboard, requiredProdDashboard, dashboard.getTotalTransactionVolume)
    router.get("/dashboard/utils/getTotalTransactionVolumeHistory", authorizeDashboard, requiredProdDashboard, dashboard.getTotalTransactionVolumeHistory)
    router.get("/dashboard/utils/getTotalTransactionAmount", authorizeDashboard, requiredProdDashboard,dashboard.getTotalTransactionAmount)
    router.get("/dashboard/utils/getTotalTransactionAmountHistory", authorizeDashboard, requiredProdDashboard,dashboard.getTotalTransactionAmountHistory)
    router.get("/dashboard/utils/getAverageTransactionValue", authorizeDashboard, requiredProdDashboard,dashboard.getAverageTransactionValue)
    router.get("/dashboard/utils/getAverageTransactionValueHistory", authorizeDashboard, requiredProdDashboard,dashboard.getAverageTransactionValueHistory)
    router.get("/dashboard/utils/getTotalDeveloperFeeVolume", authorizeDashboard, requiredProdDashboard,dashboard.getTotalDeveloperFeeVolume)
    router.get("/dashboard/utils/getTotalDeveloperFeeVolumeHistory", authorizeDashboard, requiredProdDashboard,dashboard.getTotalDeveloperFeeVolumeHistory)
    router.get("/dashboard/utils/getCurrentBillingInformation", authorizeDashboard, requiredProdDashboard,dashboard.getCurrentBillingInformation)
    router.get("/dashboard/utils/getInvoiceHistory", authorizeDashboard, requiredProdDashboard, dashboard.getInvoiceHistory)
    router.get("/dashboard/utils/getOrganization", authorizeDashboard, dashboard.getOrganization)
    router.post("/dashboard/utils/sendInvitation", authorizeDashboard, requiredAdmin, dashboard.sendInvitation)
    router.post("/dashboard/utils/acceptInvitation", authorizeDashboard, dashboard.acceptInvitation)
    router.put("/dashboard/utils/editOrganizationMember", authorizeDashboard, requiredAdmin, dashboard.editOrganizationMember)
}