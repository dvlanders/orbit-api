const createLog = require("../../src/util/logger/supabaseLogger");
const { topupBalance } = require("../../src/util/billing/balance/balanceService");
const { updateBillStatus } = require("../../src/util/billing/updateBillStatus");
const { updateBalanceTopupRecord } = require("../../src/util/billing/balance/balanceService");
const { BalanceTopupType, BalanceTopupStatus } = require("../../src/util/billing/balance/utils");
const { releaseAutopayLock } = require("../../src/util/billing/lockService");
const { enableProdAccess } = require("../../src/util/auth/profileService");
const { createApiKeyFromProvider } = require("../../src/util/auth/createApiKey/createZuploApiKey");

const processInvoiceEvent = async (event) => {
  try {
    await updateBillStatus(event);
    const metadata = event.data?.object?.metadata;
    const { type, profileId, credit, topupRecordId } = metadata;

    if (event.type === "invoice.paid") {
      if (type === BalanceTopupType.AUTOPAY) {
        await topupBalance(profileId, credit, topupRecordId, event.data?.object?.invoice_pdf);
        await releaseAutopayLock(profileId);
      }else if(type === BalanceTopupType.CHECKOUT){
        const creditToAdd = credit || Math.floor(event.data?.object?.lines?.data[0].amount_excluding_tax / 100);
        await topupBalance(profileId, creditToAdd, topupRecordId, event.data?.object?.invoice_pdf);
      }else if(type === BalanceTopupType.ACCOUNT_MINIMUM){
        await enableProdAccess(profileId);
        await createApiKeyFromProvider(profileId, "dashboardApiKey", new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), "production", true);
        await topupBalance(profileId, credit, topupRecordId, event.data?.object?.invoice_pdf);
      }
    }else if(event.type === "invoice.void" || event.type === "invoice.uncollectible" || event.type === "invoice.payment_failed"){
      if (type === BalanceTopupType.AUTOPAY) {
        await updateBalanceTopupRecord(topupRecordId, {status: BalanceTopupStatus.FAILED});
        await releaseAutopayLock(profileId);
      }else if(type === BalanceTopupType.CHECKOUT || type === BalanceTopupType.ACCOUNT_MINIMUM){
        await updateBalanceTopupRecord(topupRecordId, {status: BalanceTopupStatus.FAILED});
      }
    }
  } catch (error) {
    await createLog(
      "webhooks/stripe/processInvoiceEvent",
      null,
      `Failed to process invoice event`,
      error
    );
    throw error;
  }
};

module.exports = {
  processInvoiceEvent,
};
