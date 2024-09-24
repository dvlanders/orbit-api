const createLog = require("../../src/util/logger/supabaseLogger");

const processPaymentIntentEvent = async (event) => {
  try {
    //TODO: Implement this function if needed in the future
    return;
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
