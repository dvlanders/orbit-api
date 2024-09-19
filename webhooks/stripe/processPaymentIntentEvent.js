const createLog = require("../../src/util/logger/supabaseLogger");
const { enableProdAccess } = require("../../src/util/auth/profileService");
const { topupBalance } = require("../../src/util/billing/balance/balanceService");

const processPaymentIntentEvent = async (event) => {
  try {
    if (event.type === "payment_intent.succeeded") {
      const metadata = event.data?.object?.metadata;
      const { type, profileId, credit } = metadata;
      if (type === "account_minimum") {
        await enableProdAccess(profileId); // enable prod access after account minimum is paid
        await topupBalance(profileId, credit, null, event.data?.object?.id);
      }
    }
  } catch (error) {
    await createLog(
      "webhooks/stripe/processPaymentIntentEvent",
      null,
      `Failed to process payment intent event`,
      error
    );
    throw error;
  }
};

module.exports = {
  processPaymentIntentEvent,
};
