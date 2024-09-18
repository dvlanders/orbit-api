const createLog = require("../../src/util/logger/supabaseLogger");
const supabase = require("../../src/util/supabaseClient");
const { supabaseCall } = require("../../src/util/supabaseWithRetry");
const {
  updateCustomerBillingInfo,
} = require("../../src/util/billing/billingInfoService");
const { accountMinimumPay } = require("../../src/util/billing/payments");
const stripe = require("stripe")(process.env.STRIPE_SK_KEY);

const processSetupIntentEvent = async (event) => {
  try {
    if (event.type === "setup_intent.succeeded") {
      const object = event.data?.object;
      const customerId = object?.customer;
      const paymentMethodId = object?.payment_method;

      if (customerId && paymentMethodId)
        // update stripe customer's default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

      await updateCustomerBillingInfo(customerId, {
        stripe_default_payment_method_id: paymentMethodId,
      });

      // if this is an onboarding setup intent, then we automatically pay the account minimum with the newly set up payment method
      if (object?.metadata?.type === "onboard") {
        const profileId = object?.metadata?.profileId;
        await accountMinimumPay(profileId);
      }
    }
  } catch (error) {
    await createLog(
      "webhooks/stripe/processSetupIntentEvent",
      null,
      `Failed to process setup intent event`,
      error
    );
    throw error;
  }
};

module.exports = {
  processSetupIntentEvent,
};
