const createLog = require("../../src/util/logger/supabaseLogger");
const { topupBalance } = require("../../src/util/billing/balance/balanceService");
const { updateBillStatus } = require("../../src/util/billing/updateBillStatus");


const processInvoiceEvent = async (event) => {
  try {
    await updateBillStatus(event);

    if (event.type === "invoice.paid") {
      const metadata = event.data?.object?.metadata;
      const { type, profileId, credit } = metadata;
      if (type === "fund") {
        const creditToAdd = credit || Math.floor(event.data?.object?.lines?.data[0].amount_excluding_tax / 100)
        await topupBalance(profileId, creditToAdd, event.data?.object?.id);
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
