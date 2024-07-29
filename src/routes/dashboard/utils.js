
const { dashboard } = require("../../controllers");
const { authorize, authorizeDashboard } = require("../../util/middleware");

module.exports = (router) => {
    router.get("/dashboard/utils/getWalletBalance", authorizeDashboard, dashboard.getWalletBalance)
    router.get("/dashboard/utils/getTotalTransactionVolume", authorizeDashboard, dashboard.getTotalTransactionVolume)
    router.get("/dashboard/utils/getTotalTransactionVolumeHistory", authorizeDashboard, dashboard.getTotalTransactionVolumeHistory)
    router.get("/dashboard/utils/getTotalTransactionAmount", authorizeDashboard, dashboard.getTotalTransactionAmount)
    router.get("/dashboard/utils/getTotalTransactionAmountHistory", authorizeDashboard, dashboard.getTotalTransactionAmountHistory)
    router.get("/dashboard/utils/getAverageTransactionValue", authorizeDashboard, dashboard.getAverageTransactionValue)
    router.get("/dashboard/utils/getAverageTransactionValueHistory", authorizeDashboard, dashboard.getAverageTransactionValueHistory)
    router.get("/dashboard/utils/getTotalDeveloperFeeVolume", authorizeDashboard, dashboard.getTotalDeveloperFeeVolume)
    router.get("/dashboard/utils/getTotalDeveloperFeeVolumeHistory", authorizeDashboard, dashboard.getTotalDeveloperFeeVolumeHistory)
    router.get("/dashboard/utils/getCurrentBillingInformation", authorizeDashboard, dashboard.getCurrentBillingInformation)
    router.get("/dashboard/utils/getInvoiceHistory", authorizeDashboard, dashboard.getInvoiceHistory)

}