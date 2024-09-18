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
        await topupBalance(profileId, credit);
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
